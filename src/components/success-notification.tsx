"use client";

import { useEffect, useState, type ReactNode } from "react";

export function SuccessNotification({ message, action, onDismiss }: { message: ReactNode; action: ReactNode; onDismiss: () => void }) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(onDismiss, 8000);
    return () => window.clearTimeout(timer);
  }, [paused, onDismiss]);
  return <div className="cart-notification" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false); }}>
    <p role="status" aria-live="polite"><span className="cart-notification-check" aria-hidden="true">✓</span><span>{message}</span></p>
    <div className="cart-notification-actions">{action}<button type="button" className="cart-notification-close" aria-label="Dismiss notification" onClick={onDismiss}>×</button></div>
  </div>;
}
