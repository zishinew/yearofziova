import "server-only";
import type Stripe from "stripe";
import { paymentServices } from "@/lib/stripe";
import { stripeKeyMode } from "@/lib/stripe-mode";

export async function fulfillSession(sessionId: string, refunded = false) {
  const { stripe, db } = paymentServices();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.livemode !== (stripeKeyMode(process.env.STRIPE_SECRET_KEY) === "live")) throw new Error("Stripe environment mismatch");
  if (!refunded && session.payment_status !== "paid") return;
  if (session.mode !== "payment" || !session.metadata?.order_id || !session.client_reference_id) throw new Error("Invalid checkout session");
  const intent = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
  if (!intent) throw new Error("Missing payment intent");
  const { data: order, error } = await db.from("checkout_orders").select("id,user_id,guest_email,items").eq("id",session.metadata.order_id).single();
  if (error || !order || (order.guest_email ? order.id : order.user_id) !== session.client_reference_id) throw new Error("Order owner mismatch");
  const { data:lineItems } = await stripe.checkout.sessions.listLineItems(session.id,{limit:100,expand:["data.price.product"]});
  const expected = order.items as {product_id:string;unit_amount:number}[];
  if (!Array.isArray(expected) || lineItems.length !== expected.length || expected.some(item=>!lineItems.some(line=>{
    const product = line.price?.product;
    return typeof product !== "string" && product && !product.deleted && product.metadata.product_id === item.product_id
      && line.quantity === 1 && line.price?.unit_amount === item.unit_amount && line.price.currency === "cad";
  }))) throw new Error("Checkout items mismatch");
  const { error: grantError } = await db.rpc("complete_checkout_order",{
    p_order_id:session.metadata.order_id, p_session_id:session.id, p_payment_intent:intent,
    p_amount:session.amount_total, p_currency:session.currency, p_refund:refunded,
  });
  if (grantError) throw grantError;
}
export async function processPaymentEvent(event: Stripe.Event) {
  const { stripe, db } = paymentServices();
  if (event.livemode !== (stripeKeyMode(process.env.STRIPE_SECRET_KEY) === "live")) throw new Error("Stripe environment mismatch");
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    await fulfillSession((event.data.object as Stripe.Checkout.Session).id);
  } else if (event.type === "checkout.session.expired" || event.type === "checkout.session.async_payment_failed") {
    const session = await stripe.checkout.sessions.retrieve((event.data.object as Stripe.Checkout.Session).id);
    if (session.payment_status === "paid") { await fulfillSession(session.id); return; }
    const status = event.type === "checkout.session.expired" ? "expired" : "failed";
    const { error } = await db.from("checkout_orders").update({status}).eq("stripe_session_id",session.id).eq("status","pending");
    if (error) throw error;
  } else if (event.type === "charge.refunded") {
    // Retrieve current state to handle duplicate/out-of-order refund notifications.
    const charge = await stripe.charges.retrieve((event.data.object as Stripe.Charge).id);
    if (charge.amount_refunded < charge.amount) return; // Partial refunds retain delivery access.
    const intentId = typeof charge.payment_intent === "string" ? charge.payment_intent : charge.payment_intent?.id;
    if (!intentId) return;
    const intent = await stripe.paymentIntents.retrieve(intentId);
    const orderId = intent.metadata.order_id;
    if (!orderId) return;
    const { data: order, error } = await db.from("checkout_orders").select("stripe_session_id").eq("id",orderId).single();
    if (error || !order?.stripe_session_id) throw new Error("Refund order missing");
    await fulfillSession(order.stripe_session_id,true);
  }
}
