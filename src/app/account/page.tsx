import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account-shell";
import { DownloadButton } from "@/components/download-button";
import { logout } from "@/app/auth/actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: purchases, error } = await supabase.from("purchases")
    .select("id, purchased_at, download_products!inner(id, title, bpm, lease)")
    .eq("user_id", user.id).eq("status", "paid").order("purchased_at", { ascending: false });
  const params = await searchParams;
  const { data: admin } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();

  return (
    <AccountShell>
      <section className="downloads-library">
        {admin && <Link href="/admin" className="admin-entry">Admin dashboard ↗</Link>}
        <div className="downloads-heading"><div><h1>My Downloads</h1><p>{user.email}</p></div>
          <form action={logout}><button className="auth-text-link" type="submit">Sign out</button></form>
        </div>
        {params.error === "signout" && <p className="auth-error" role="alert">Couldn’t sign out. Please try again.</p>}
        {error ? <p className="auth-error" role="alert">Couldn’t load your downloads. Please refresh and try again.</p> : purchases?.length ? (
          <ul className="downloads-list">
            {purchases.map((purchase) => {
              const product = Array.isArray(purchase.download_products) ? purchase.download_products[0] : purchase.download_products;
              if (!product) return null;
              return <li key={purchase.id}>
                <div><h2>{product.title}</h2><p>{product.bpm ? `${product.bpm} BPM` : "Purchased beat"}{product.lease ? ` · ${product.lease.toUpperCase()} lease` : ""}</p></div>
                <DownloadButton purchaseId={purchase.id} />
              </li>;
            })}
          </ul>
        ) : <div className="downloads-empty"><p>Your purchased beats will appear here.</p>
          <p>Already bought a beat? <a href="https://www.instagram.com/yearofziova/" target="_blank" rel="noreferrer">DM @yearofziova</a> to link your purchase.</p>
          <Link href="/">Explore the vault ↗</Link>
        </div>}
        <Link className="auth-text-link" href="/account/password">Change password</Link>
      </section>
    </AccountShell>
  );
}
