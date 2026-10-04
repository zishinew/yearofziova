import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account-shell";
import { PaymentConfirming } from "@/components/payment-confirming";
import { DownloadButton } from "@/components/download-button";
import { CheckoutStatus } from "@/components/checkout-status";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fulfillSession } from "@/lib/checkout-fulfillment";
import { getAdminSession } from "@/lib/supabase/admin";
import { parseCheckoutItems } from "@/lib/payments";
export const dynamic = "force-dynamic";
export default async function CheckoutSuccess({ searchParams }: { searchParams:Promise<{session_id?:string}> }) {
  if (await getAdminSession()) redirect("/admin");
  const supabase = await createServerSupabaseClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user || !supabase) redirect("/login");
  const { session_id } = await searchParams;
  const findOrder = () => supabase.from("checkout_orders").select("id,status,items,amount").eq("stripe_session_id",session_id || "").eq("user_id",user.id).maybeSingle();
  let { data:order } = session_id && /^cs_[a-zA-Z0-9_]+$/.test(session_id)
    ? await findOrder()
    : { data:null };
  // The URL only identifies an order owned by this signed-in customer.
  // Fulfillment independently verifies payment, amount, currency and items with Stripe.
  if (session_id && order?.status === "pending") {
    try {
      await fulfillSession(session_id);
      order = (await findOrder()).data;
    } catch {
      console.error("Checkout return fulfillment failed; awaiting webhook retry.");
    }
  }
  const paid = order?.status === "paid";
  const pending = order?.status === "pending";
  const { data: purchases, error: downloadError } = paid && order
    ? await supabase.from("purchases").select("id,product_id,download_products!inner(title,bpm,lease,catalog_tracks(cover_path))")
      .eq("checkout_order_id",order.id).eq("user_id",user.id).eq("status","paid")
    : { data:null, error:null };
  return <AccountShell>
    <CheckoutStatus paid={paid} pending={pending} items={parseCheckoutItems(order?.items) || []} />
    {pending ? <PaymentConfirming /> : <section className="downloads-library purchase-receipt" aria-live="polite">
      <div className="downloads-heading"><div>
        <h1>{paid ? "Your purchase" : "Payment status"}</h1>
        <p>{paid ? "Payment confirmed. Your files are ready." : order?.status === "refunded" ? "This order has been refunded." : "We couldn't find a completed purchase for this account."}</p>
      </div></div>
      {paid && <>
        {downloadError || !purchases?.length ? <p className="auth-error" role="alert">Couldn’t load your files. They are also available in My Downloads.</p> : <ul className="purchase-grid">
          {purchases.map(purchase => {
            const product = Array.isArray(purchase.download_products) ? purchase.download_products[0] : purchase.download_products;
            if (!product) return null;
            const snapshot = Array.isArray(order?.items) ? order.items.find((item: {product_id:string}) => item.product_id === purchase.product_id) : null;
            const track = Array.isArray(product.catalog_tracks) ? product.catalog_tracks[0] : product.catalog_tracks;
            const cover = track?.cover_path ? supabase.storage.from("track-covers").getPublicUrl(track.cover_path).data.publicUrl : null;
            return <li key={purchase.id} className="purchase-card">
              <div className="purchase-cover">
                {cover ? <Image src={cover} alt="" fill sizes="(max-width: 600px) 90vw, (max-width: 900px) 45vw, 320px" /> : <Image src="/eye transparent.png" alt="" width={120} height={120} className="purchase-cover-placeholder" />}
              </div>
              <div className="purchase-card-body">
                <div className="purchase-card-details"><h2>{snapshot?.title || product.title}</h2><p>{product.lease ? `${product.lease.toUpperCase()} lease` : "Purchased file"}{product.bpm ? ` · ${product.bpm} BPM` : ""}</p></div>
                <DownloadButton purchaseId={purchase.id} label={product.lease ? `Download ${product.lease.toUpperCase()} ↓` : undefined} />
              </div>
            </li>;
          })}
        </ul>}
        <p className="purchase-total">Total paid <span>${((order?.amount || 0) / 100).toFixed(2)} CAD</span></p>
        <p className="purchase-note">You can redownload these files anytime from your account.</p>
      </>}
      <Link href="/account" prefetch={false} className="auth-text-link">My Downloads ↗</Link>
    </section>}
  </AccountShell>;
}
