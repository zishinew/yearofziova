import { paymentServices } from "@/lib/stripe";
import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account-shell";
import { DownloadsSync } from "@/components/downloads-sync";
import { DownloadButton } from "@/components/download-button";
import { logout } from "@/app/auth/actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { groupDownloads } from "@/lib/download-library";

export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createServerSupabaseClient();
  if (!supabase) redirect("/login");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: admin } = await supabase.from("admin_users").select("user_id").eq("user_id", user.id).maybeSingle();
  if (admin && user.email_confirmed_at) redirect("/admin");
  if (user.email_confirmed_at) {
    const { error: claimError } = await paymentServices().db.rpc("claim_guest_orders", { p_user_id: user.id });
    if (claimError) console.error("Guest purchase linking unavailable");
  }
  const { data: purchases, error } = await supabase.from("purchases")
    .select("id, purchased_at, download_products!inner(id, title, bpm, lease, catalog_track_id, catalog_tracks(cover_path))")
    .eq("user_id", user.id).eq("status", "paid").order("purchased_at", { ascending: false });
  const params = await searchParams;
  const downloads = groupDownloads(purchases || []);

  return (
    <AccountShell>
      <DownloadsSync userId={user.id} revision={(purchases || []).map(p => p.id).sort().join(",")} />
      <section className="downloads-library">
        <div className="downloads-heading"><div><h1>My Downloads</h1><p>{user.email}</p></div>
          <form action={logout}><button className="auth-text-link" type="submit">Sign out</button></form>
        </div>
        {params.error === "signout" && <p className="auth-error" role="alert">Couldn’t sign out. Please try again.</p>}
        {error ? <p className="auth-error" role="alert">Couldn’t load your downloads. Please refresh and try again.</p> : purchases?.length ? (
          <ul className="downloads-list" aria-live="polite">
            {downloads.map((entry) => {
              const cover = entry.coverPath ? supabase.storage.from("track-covers").getPublicUrl(entry.coverPath).data.publicUrl : null;
              return <li key={entry.id}>
                <div className="download-track">
                  <div className="download-cover">
                    {cover ? <Image src={cover} alt="" fill sizes="80px" /> : <Image src="/eye transparent.png" alt="" width={48} height={48} />}
                  </div>
                  <div><h2>{entry.title}</h2><p>{entry.bpm ? `${entry.bpm} BPM` : "Purchased file"}</p></div>
                </div>
                <div className="download-formats">
                  {entry.downloads.map(download => <DownloadButton key={download.purchaseId} purchaseId={download.purchaseId} label={download.lease ? `Download ${download.lease.toUpperCase()} ↓` : "Download ↓"} />)}
                </div>
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
