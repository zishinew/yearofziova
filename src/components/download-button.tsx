"use client";

import { useState, useTransition } from "react";
import { downloadPurchase } from "@/app/account/download-action";

export function DownloadButton({ purchaseId, label = "Download ↓", format }: { purchaseId: string; label?: string; format?: "mp3" | "wav" }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  return (
    <div className="download-control">
      <button type="button" disabled={pending} onClick={() => {
        setError("");
        startTransition(async () => {
          try {
            const result = await downloadPurchase(purchaseId, format);
            if (result.url) window.location.assign(result.url);
            else setError(result.error || "Couldn't prepare your download.");
          } catch {
            setError("Couldn't prepare your download. Please try again.");
          }
        });
      }}>{pending ? "Preparing…" : label}</button>
      {error && <p className="auth-error" role="alert">{error}</p>}
    </div>
  );
}
