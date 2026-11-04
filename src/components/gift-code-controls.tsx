"use client";

import { useActionState, useState } from "react";
import { createGiftCode, revokeGiftCode } from "@/app/admin/gift-codes/actions";

export function GiftCodeForm() {
  const [result, action, pending] = useActionState(createGiftCode, {});
  return <div>
    <form action={action} className="admin-fields">
      <label>Label<input name="label" required maxLength={80} placeholder="e.g. Alex" /></label>
      <button className="auth-submit" disabled={pending}>{pending ? "Creating…" : "Create gift code"}</button>
    </form>
    {result.error && <p className="auth-error" role="alert">{result.error}</p>}
    {result.code && <GiftCodeResult key={result.code} code={result.code} />}
  </div>;
}

function GiftCodeResult({ code }: { code: string }) {
  const [status, setStatus] = useState("");
  return <div className="gift-code-result">
    <label className="checkout-email">Copy this code now. It’s only shown once.<input readOnly value={code} onFocus={event => event.target.select()} /></label>
    <button type="button" className="auth-text-link" onClick={async () => {
      try { await navigator.clipboard.writeText(code); setStatus("Copied."); }
      catch { setStatus("Select the code to copy it manually."); }
    }}>Copy code</button>
    <p className="admin-hint" role="status">{status}</p>
  </div>;
}

export function RevokeGiftCode({ id, label }: { id: string; label: string }) {
  const [error, action, pending] = useActionState(revokeGiftCode, "");
  return <form action={action} onSubmit={event => {
    if (!window.confirm(`Revoke the gift code for “${label}”? Existing downloads will still work.`)) event.preventDefault();
  }}>
    <input type="hidden" name="id" value={id} />
    <button className="auth-text-link" disabled={pending}>{pending ? "Revoking…" : "Revoke"}</button>
    {error && <p className="auth-error" role="alert">{error}</p>}
  </form>;
}
