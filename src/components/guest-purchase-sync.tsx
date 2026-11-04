"use client";

import { useEffect } from "react";

const key = "ziova-guest-owned-tracks-v1";
export const guestOwnershipChanged = "ziova-guest-ownership-changed";

export function GuestPurchaseSync({ trackIds }: { trackIds: string[] }) {
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(key) || "[]");
      const existing = Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : [];
      localStorage.setItem(key, JSON.stringify([...new Set([...existing, ...trackIds])]));
      window.dispatchEvent(new Event(guestOwnershipChanged));
    } catch {}
  }, [trackIds]);

  return null;
}

export function readGuestOwnedTracks() {
  try {
    const stored = JSON.parse(localStorage.getItem(key) || "[]");
    return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}
