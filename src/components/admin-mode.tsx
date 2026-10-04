"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

const AdminMode = createContext(false);
export function AdminModeProvider({ isAdmin, children }: { isAdmin: boolean; children: ReactNode }) {
  const router = useRouter();
  useEffect(() => {
    const client = createBrowserSupabaseClient();
    let initialized = false;
    let previousUser: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
      const user = session?.user.id ?? null;
      if (initialized && user !== previousUser) {
        // Refresh server-verified membership outside the auth callback lock.
        clearTimeout(timer);
        timer = setTimeout(() => router.refresh(), 0);
      }
      initialized = true;
      previousUser = user;
    });
    return () => { clearTimeout(timer); subscription.unsubscribe(); };
  }, [router]);
  return <AdminMode.Provider value={isAdmin}>{children}</AdminMode.Provider>;
}
export function useAdminMode() { return useContext(AdminMode); }
