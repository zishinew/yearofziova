"use client";
import { useEffect, useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import type { CheckoutItem } from "@/lib/payments";

export function useOwnedLeases() {
  const [state, setState] = useState<{ items: CheckoutItem[]; ready: boolean }>({ items: [], ready: false });
  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let userId: string | null = null;
    let initialized = false;
    let disposed = false;
    let version = 0;
    async function refresh() {
      if (disposed || document.visibilityState === "hidden" || !initialized) return;
      const current = ++version;
      const owner = userId;
      if (!owner) { setState(previous => previous.ready && !previous.items.length ? previous : { items: [], ready: true }); return; }
      const { data, error } = await supabase.from("purchases")
        .select("download_products!inner(catalog_track_id,lease)").eq("user_id", owner).eq("status", "paid");
      if (disposed || current !== version || userId !== owner || error || !data) return;
      const items: CheckoutItem[] = [];
      for (const purchase of data) {
        const product = Array.isArray(purchase.download_products) ? purchase.download_products[0] : purchase.download_products;
        if (product?.catalog_track_id && (product.lease === "mp3" || product.lease === "wav") && !items.some(i => i.id === product.catalog_track_id && i.lease === product.lease)) {
          items.push({ id: product.catalog_track_id, lease: product.lease });
          if (product.lease === "wav" && !items.some(i => i.id === product.catalog_track_id && i.lease === "mp3")) items.push({ id: product.catalog_track_id, lease: "mp3" });
        }
      }
      items.sort((a,b) => `${a.id}:${a.lease}`.localeCompare(`${b.id}:${b.lease}`));
      setState(previous => previous.ready && JSON.stringify(previous.items) === JSON.stringify(items) ? previous : { items, ready: true });
    }
    const check = () => { void refresh().catch(() => {}); };
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = session?.user.id ?? null;
      if (!initialized || next !== userId) {
        initialized = true; userId = next; version++;
        setState({ items: [], ready: !next });
      }
      // Run database queries after Supabase releases its auth callback lock.
      window.setTimeout(check, 0);
    });
    const timer = window.setInterval(check, 3000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => {
      disposed = true; version++;
      subscription.unsubscribe(); window.clearInterval(timer);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  return state;
}
