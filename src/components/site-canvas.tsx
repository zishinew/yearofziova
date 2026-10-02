"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { PixelLiquidBg } from "@/components/ui/pixel-liquid-bg";

export function SiteCanvas() {
  const [canvasReady, setCanvasReady] = useState(false);
  const [minimumElapsed, setMinimumElapsed] = useState(false);
  const handleReady = useCallback(() => setCanvasReady(true), []);
  const loading = !canvasReady || !minimumElapsed;

  useEffect(() => {
    // Keep fast loads from flashing the icon for only a single frame.
    const timer = window.setTimeout(() => setMinimumElapsed(true), 600);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
      <main
        aria-busy={loading}
        inert={loading}
        className="fixed inset-0 overflow-hidden bg-white"
      >
        <PixelLiquidBg pixelSize={8} onReady={handleReady} />
      </main>
      {loading && (
        <div
          role="status"
          aria-label="Loading page"
          className="fixed inset-0 z-50 grid place-items-center bg-white"
        >
          <Image
            src="/ziova.jpg"
            alt=""
            width={192}
            height={192}
            preload
            className="h-36 w-36 rounded-full object-cover motion-safe:animate-pulse sm:h-48 sm:w-48"
          />
        </div>
      )}
    </>
  );
}
