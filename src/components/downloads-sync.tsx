"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

export function DownloadsSync({ userId, revision }: { userId: string; revision: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let disposed = false;
    let checking = false;
    async function check() {
      if (disposed || checking || document.visibilityState === "hidden") return;
      checking = true;
      try {
        // RLS restricts this query to the signed-in customer's purchases.
        const { data, error } = await supabase.from("purchases").select("id")
          .eq("user_id", userId).eq("status", "paid");
        if (!disposed && !error && data && data.map(p => p.id).sort().join(",") !== revision) {
          router.refresh();
        }
      } finally { checking = false; }
    }
    const checkQuietly = () => { void check().catch(() => {}); };
    // Check immediately when returning to a previously cached account page.
    checkQuietly();
    const timer = window.setInterval(checkQuietly, 3000);
    window.addEventListener("focus", checkQuietly);
    document.addEventListener("visibilitychange", checkQuietly);
    return () => {
      disposed = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", checkQuietly);
      document.removeEventListener("visibilitychange", checkQuietly);
    };
  }, [userId, revision, router]);
  return null;
}
