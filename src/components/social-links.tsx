"use client";

import { useEffect, useState } from "react";

export function SocialLinks() {
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 2500);
    return () => window.clearTimeout(timer);
  }, [message]);

  async function copyDiscord() {
    try {
      await navigator.clipboard.writeText("yearofziova");
      setMessage("Username copied ✓");
    } catch {
      setMessage("Couldn't copy · yearofziova");
    }
  }

  return <nav className="landing-socials" aria-label="Socials">
    <a href="https://www.instagram.com/yearofziova/" target="_blank" rel="noreferrer" aria-label="Instagram @yearofziova" title="Instagram">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    </a>
    <a href="https://www.tiktok.com/@yearofziova" target="_blank" rel="noreferrer" aria-label="TikTok @yearofziova" title="TikTok">
      <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M16.6 2h-3.3v13.4a3 3 0 1 1-2.5-3V9a6.4 6.4 0 1 0 5.8 6.4V8.6a8.5 8.5 0 0 0 5 1.6V6.9c-2.8-.2-4.7-2.1-5-4.9Z" />
      </svg>
    </a>
    <div className="social-copy">
      <button type="button" onClick={() => { void copyDiscord(); }} aria-label="Copy Discord username yearofziova" title="Copy Discord username">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M19.7 5.2a18 18 0 0 0-4.4-1.4l-.5 1a16.3 16.3 0 0 0-5.6 0l-.5-1a18 18 0 0 0-4.4 1.4C1.5 9.3.8 13.3 1.2 17.3a18 18 0 0 0 5.4 2.7l1.1-1.8-1.7-.8.4-.3a13.8 13.8 0 0 0 11.2 0l.4.3-1.7.8 1.1 1.8a18 18 0 0 0 5.4-2.7c.5-4.6-.8-8.6-3.1-12.1ZM8.5 14.8c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Zm7 0c-1 0-1.8-.9-1.8-2s.8-2 1.8-2 1.8.9 1.8 2-.8 2-1.8 2Z" />
        </svg>
      </button>
      <span className="social-copy-indicator" role="status">{message}</span>
    </div>
  </nav>;
}
