"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { downloadLoop } from "@/app/loops/download-action";

export function LoopDownload({ id, title }: { id: string; title: string }) {
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    return () => { element?.close(); document.body.style.overflow = overflow; };
  }, [open]);
  return <>
    <button className="track-add" type="button" aria-label={`Download ${title}`} onClick={() => { setAccepted(false); setError(""); setOpen(true); }}>Download ↓</button>
    {open && <dialog ref={dialog} className="cart-dialog loop-terms-dialog" aria-labelledby={titleId} onCancel={() => setOpen(false)}>
      <div className="cart-heading"><h2 id={titleId}>Loop terms of use</h2><button type="button" aria-label="Close terms" onClick={() => setOpen(false)}>×</button></div>
      <p className="loop-terms-track">{title} · @yearofziova</p>
      <div className="loop-terms-copy">
        <p>These loops are free to download for use in your own beats, subject to the following terms.</p>
        <ol>
          <li><strong>Splits.</strong> Beats made using any loop in this kit must be split 50/50 between you and @yearofziova. If additional collaborators are involved, splits must be evenly distributed among @yearofziova and all collaborators, unless otherwise agreed.</li>
          <li><strong>Credit.</strong> When posting beats online, include @yearofziova in the title and list @yearofziova as a collaborator.</li>
          <li><strong>Commercial use.</strong> Contact @yearofziova on Instagram before releasing any commercial use, including placements. Downloading these loops does not grant permission for commercial release.</li>
          <li><strong>No redistribution.</strong> You may not distribute these loops as your own work or claim authorship of them.</li>
        </ol>
        <p>Send me what you make—I’m excited to hear it!<br />Instagram: <a href="https://www.instagram.com/yearofziova/" target="_blank" rel="noreferrer">@yearofziova ↗</a><br />Discord: yearofziova</p>
      </div>
      <label className="checkout-email">Email<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" required /></label>
      <p className="cart-note">No account needed. <Link href="/login?signup=1" scroll={false} onClick={() => setOpen(false)}>Create an account</Link> for easier access to purchased beats.</p>
      <label className="loop-terms-agreement"><input type="checkbox" checked={accepted} onChange={event => setAccepted(event.target.checked)} /> <span>I have read and agree to these terms of use.</span></label>
      {error && <p className="auth-error" role="alert">{error}</p>}
      <button type="button" className="lease-confirm" disabled={!accepted || pending} onClick={() => {
        if (!accepted || pending) return;
        setError("");
        startTransition(async () => {
          try {
            const result = await downloadLoop(id, accepted, email);
            if (result.url) { window.location.assign(result.url); setOpen(false); }
            else setError(result.error || "Couldn't prepare your download.");
          } catch { setError("Couldn't prepare your download. Please try again."); }
        });
      }}>{pending ? "Preparing download…" : "Agree & download ↓"}</button>
    </dialog>}
  </>;
}
