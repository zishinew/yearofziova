"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { downloadAdminTrack, getAdminDownloadFiles } from "@/app/admin/download-action";

export function AdminTrackDownload({ id, title }: { id: string; title: string }) {
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<{ id: string; label: string }[]>([]);
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
    <button type="button" className="track-add" aria-label={`Download ${title}`} onClick={() => {
      setFiles([]); setError(""); setOpen(true);
      startTransition(async () => {
        try {
          const result = await getAdminDownloadFiles(id);
          if (result.error) setError(result.error);
          else setFiles(result.files || []);
        } catch { setError("Couldn't load the files. Please try again."); }
      });
    }}>Download</button>
    {open && <dialog ref={dialog} className="cart-dialog" aria-label={`Download ${title}`} onCancel={() => setOpen(false)}>
      <div className="cart-heading"><h2>Download files</h2><button type="button" aria-label="Close downloads" onClick={() => setOpen(false)}>×</button></div>
      <p className="lease-track-title">{title}</p>
      <div className="admin-download-files">
        {files.map(file => <button type="button" className="track-add" key={file.id} disabled={pending} onClick={() => {
          setError("");
          startTransition(async () => {
            try {
              const result = await downloadAdminTrack(id,file.id);
              if (result.url) window.location.assign(result.url);
              else setError(result.error || "Couldn't prepare your download.");
            } catch { setError("Couldn't prepare your download. Please try again."); }
          });
        }}>{file.label} ↓</button>)}
      </div>
      {pending && <p className="cart-note" role="status">Preparing files…</p>}
      {!pending && !files.length && !error && <p className="cart-note">No files are available for this track.</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
    </dialog>}
  </>;
}
