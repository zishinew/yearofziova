import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account-shell";
import { CheckoutStatus } from "@/components/checkout-status";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { fulfillSession } from "@/lib/checkout-fulfillment";
import { parseCheckoutItems } from "@/lib/payments";
export const dynamic = "force-dynamic";
export default async function CheckoutSuccess({ searchParams }: { searchParams:Promise<{session_id?:string}> }) {
  const supabase = await createServerSupabaseClient();
  const user = supabase ? (await supabase.auth.getUser()).data.user : null;
  if (!user || !supabase) redirect("/login");
  const { session_id } = await searchParams;
  const findOrder = () => supabase.from("checkout_orders").select("status,items").eq("stripe_session_id",session_id || "").eq("user_id",user.id).maybeSingle();
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
  return <AccountShell><section className="downloads-library">
    <CheckoutStatus paid={paid} pending={pending} items={parseCheckoutItems(order?.items) || []} />
    <h1>{paid ? "Thank you." : pending ? "Confirming your payment…" : "Payment status"}</h1>
    <p className="auth-message">{paid ? "Your beats are ready in My Downloads." : pending ? "Your downloads will appear once payment is confirmed. You can safely leave this page." : order?.status === "refunded" ? "This order has been refunded." : "We couldn't find a completed purchase for this account. Check My Downloads or DM @yearofziova."}</p>
    <Link href="/account" className="auth-text-link">My Downloads ↗</Link>
  </section></AccountShell>;
}
