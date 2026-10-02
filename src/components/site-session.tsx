"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

const SiteSessionContext = createContext({ entered: false, enter: () => {} });

export function SiteSession({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [entered, setEntered] = useState(pathname !== "/");
  const enter = useCallback(() => setEntered(true), []);
  const value = useMemo(() => ({ entered, enter }), [entered, enter]);
  return <SiteSessionContext.Provider value={value}>{children}</SiteSessionContext.Provider>;
}

export function useSiteSession() {
  return useContext(SiteSessionContext);
}
