"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export function AuthDialog({ children, intercepted = false }: { children: ReactNode; intercepted?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const dismiss = () => intercepted ? router.back() : router.replace("/");

  useEffect(() => {
    const element = dialog.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    return () => {
      element?.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <dialog ref={dialog} className="auth-dialog" aria-labelledby="auth-title"
      onCancel={(event) => { event.preventDefault(); dismiss(); }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dismiss();
      }}>
      <button type="button" className="auth-close" aria-label="Close account dialog" onClick={dismiss}>×</button>
      {children}
    </dialog>
  );
}
