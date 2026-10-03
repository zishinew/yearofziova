"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { PixelLiquidBg } from "@/components/ui/pixel-liquid-bg";

const SiteSessionContext = createContext({ entered: false, canvasReady: false });

export function SiteSession({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [entered, setEntered] = useState(pathname !== "/");
  const [canvasReady, setCanvasReady] = useState(false);
  const handleReady = useCallback(() => {
    setCanvasReady(true);
    setEntered(true);
  }, []);
  const value = useMemo(() => ({ entered, canvasReady }), [entered, canvasReady]);
  return <SiteSessionContext.Provider value={value}>
    <div className="site-fluid" aria-hidden="true"><PixelLiquidBg pixelSize={8} onReady={handleReady} /></div>
    {children}
  </SiteSessionContext.Provider>;
}

export function useSiteSession() {
  return useContext(SiteSessionContext);
}
