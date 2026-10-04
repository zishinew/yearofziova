"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getEditableTrack } from "@/app/admin/actions";
import type { AdminTrack } from "@/lib/track-upload";

const TrackForm = dynamic(() => import("@/components/admin-dashboard").then(module => module.TrackForm), { loading: () => <p role="status">Loading editor…</p> });

export function CatalogEdit({ id, title }: { id: string; title: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [track, setTrack] = useState<AdminTrack | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    return () => { element?.close(); document.body.style.overflow = overflow; };
  }, [open]);
  return <>
    <button type="button" className="track-add" aria-label={`Edit ${title}`} onClick={() => {
      setTrack(null); setError(""); setOpen(true);
      startTransition(async () => {
        try {
          const result = await getEditableTrack(id);
          if (result.track) setTrack(result.track);
          else setError(result.error || "Couldn't load this track.");
        } catch { setError("Couldn't load this track. Please try again."); }
      });
    }}>Edit</button>
    {open && <dialog ref={dialog} className="cart-dialog catalog-edit-dialog" aria-label={`Edit ${title}`} onCancel={() => setOpen(false)}>
      {pending ? <p role="status">Loading editor…</p> : track ? <TrackForm key={track.id} kind={track.kind} track={track} onSaved={() => { setOpen(false); router.refresh(); }} onCancel={() => setOpen(false)} /> : <>
        <p className="auth-error" role="alert">{error}</p>
        <button type="button" className="auth-text-link" onClick={() => setOpen(false)}>Close</button>
      </>}
    </dialog>}
  </>;
}
