import { paymentServices } from "@/lib/stripe";
import { processPaymentEvent } from "@/lib/checkout-fulfillment";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return new Response("Webhook not configured",{ status:503 });
  const signature = request.headers.get("stripe-signature");
  if (!signature) return new Response("Missing signature",{ status:400 });
  let stripe;
  try { stripe = paymentServices().stripe; } catch { return new Response("Payments unavailable",{ status:503 }); }
  let event;
  try { event = stripe.webhooks.constructEvent(await request.text(),signature,secret); }
  catch { return new Response("Invalid signature",{ status:400 }); }
  try { await processPaymentEvent(event); }
  catch { return new Response("Fulfillment failed; retry required",{ status:500 }); }
  return Response.json({ received:true });
}
