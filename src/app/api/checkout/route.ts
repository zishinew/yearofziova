import { randomUUID } from "node:crypto";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { LEASE_PRICES, parseCheckoutItems } from "@/lib/payments";
import { paymentServices, siteOrigin } from "@/lib/stripe";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const fail = (error: string, status = 400) => Response.json({ error }, { status });
  try {
    if (request.headers.get("origin") !== siteOrigin()) return fail("Invalid checkout request.", 403);
    const supabase = await createServerSupabaseClient();
    const user = supabase ? (await supabase.auth.getUser()).data.user : null;
    if (!user?.email_confirmed_at) return fail("Please sign in with a confirmed email before checkout.", 401);
    const { data: admin, error: adminError } = await supabase!.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
    if (adminError) throw new Error("Admin membership lookup failed");
    if (admin) return fail("Admin accounts cannot purchase beats. Edit tracks from your catalog instead.", 403);
    if (process.env.VERCEL_ENV === "preview") {
      const testUser = process.env.STRIPE_SANDBOX_USER_ID;
      if (!testUser) return fail("Sandbox checkout is being configured.", 503);
      if (user.id !== testUser) return fail("Use the dedicated sandbox test account for this preview.", 403);
    }
    if (Number(request.headers.get("content-length")) > 16384) return fail("Cart is too large.");
    const body = await request.json();
    const items = parseCheckoutItems(body.items);
    if (!items) return fail("Check the beats in your cart.");
    if (!process.env.STRIPE_WEBHOOK_SECRET) return fail("Online checkout is being set up. Please try again soon.", 503);
    const { stripe, db } = paymentServices();
    const { data: tracks, error: trackError } = await db.from("catalog_tracks").select("id,title").eq("published",true).eq("kind","beats").in("id",items.map(i=>i.id));
    const { data: products, error: productError } = await db.from("download_products").select("id,catalog_track_id,lease,storage_path").in("catalog_track_id",items.map(i=>i.id));
    if (trackError || productError) throw new Error("Catalog lookup failed");
    const orderItems = [];
    for (const item of items) {
      const track = tracks?.find(t=>t.id===item.id);
      const product = products?.find(p=>p.catalog_track_id===item.id && p.lease===item.lease);
      if (!track || !product) return fail("A selected lease is not available yet. Please choose another format or DM @yearofziova.");
      const { data: file, error } = await db.storage.from("purchased-beats").info(product.storage_path);
      if (error || !file) return fail("A selected download is temporarily unavailable.",409);
      orderItems.push({ ...item, product_id: product.id, title: track.title, unit_amount: LEASE_PRICES[item.lease] });
    }
    const { data: owned, error: ownershipError } = await db.from("purchases").select("product_id")
      .eq("user_id",user.id).eq("status","paid").in("product_id",orderItems.map(item=>item.product_id));
    if (ownershipError) throw new Error("Ownership lookup failed");
    if (owned?.length) return fail("You already own a selected lease. Choose an unowned format to upgrade.",409);
    const id = randomUUID();
    const amount = orderItems.reduce((sum,item)=>sum+item.unit_amount,0);
    const { error: insertError } = await db.from("checkout_orders").insert({ id,user_id:user.id,items:orderItems,amount });
    if (insertError) throw insertError;
    const session = await stripe.checkout.sessions.create({
      mode:"payment", adaptive_pricing:{ enabled:false }, client_reference_id:user.id, customer_email:user.email,
      metadata:{ order_id:id }, payment_intent_data:{ metadata:{ order_id:id } },
      success_url:`${siteOrigin()}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:`${siteOrigin()}/`,
      line_items:orderItems.map(item=>({ quantity:1,price_data:{ currency:"cad",unit_amount:item.unit_amount,
        product_data:{ name:`${item.title} · ${item.lease.toUpperCase()} lease`,metadata:{ product_id:item.product_id } } } })),
    },{ idempotencyKey:`checkout:${id}` });
    const { error: saveError } = await db.from("checkout_orders").update({ stripe_session_id:session.id }).eq("id",id);
    if (saveError || !session.url) {
      await stripe.checkout.sessions.expire(session.id);
      throw new Error("Couldn't save checkout");
    }
    return Response.json({ url:session.url });
  } catch (error) {
    // Keep provider payloads and credentials out of logs and client responses.
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "unavailable";
    const reason = error instanceof Error && ["Payments are not configured.", "Live payments are not enabled.", "Invalid site origin."].includes(error.message)
      ? error.message : "Checkout provider or database request failed.";
    console.error("Checkout failed", { code, reason });
    return fail("Online checkout is unavailable right now. Please try again soon.",503);
  }
}
