import Link from "next/link";
import { redirect } from "next/navigation";
import { AccountShell } from "@/components/account-shell";
import { GiftCodeForm, RevokeGiftCode } from "@/components/gift-code-controls";
import { getAdminSession } from "@/lib/supabase/admin";
import { createServiceSupabaseClient } from "@/lib/supabase/service";

export const dynamic = "force-dynamic";

export default async function GiftCodesPage() {
  if (!await getAdminSession()) redirect("/admin");
  const { data: codes, error } = await createServiceSupabaseClient().from("gift_codes")
    .select("id,label,revoked_at").order("created_at", { ascending: false });

  return <AccountShell>
    <section className="admin-dashboard">
      <Link href="/admin" className="auth-text-link admin-entry">← Dashboard</Link>
      <div className="downloads-heading"><div><h1>Gift codes</h1>
        <p>Share a code to make any MP3 or WAV lease in a cart free. Codes can be reused until you revoke them.</p>
      </div></div>
      <div className="admin-layout">
        <GiftCodeForm />
        <section>
          <h2>Created codes</h2>
          {error ? <p className="auth-error" role="alert">Couldn’t load your codes.</p> : codes?.length ? <ul className="downloads-list">
            {codes.map(code => <li key={code.id}><div><p>{code.label}</p><p className="admin-hint">{code.revoked_at ? "Revoked" : "Active"}</p></div>
              {!code.revoked_at && <RevokeGiftCode id={code.id} label={code.label} />}
            </li>)}
          </ul> : <p className="admin-hint">No codes yet.</p>}
        </section>
      </div>
    </section>
  </AccountShell>;
}
