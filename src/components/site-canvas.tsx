"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PixelLiquidBg } from "@/components/ui/pixel-liquid-bg";

export function SiteCanvas() {
  const [canvasReady, setCanvasReady] = useState(false);
  const [phase, setPhase] = useState<"entering" | "center" | "docking" | "settled">("entering");
  const handleReady = useCallback(() => setCanvasReady(true), []);
  const loading = phase !== "settled";

  useEffect(() => {
    if (!canvasReady || phase !== "center") return;
    const timer = window.setTimeout(() => setPhase("docking"), 250);
    return () => window.clearTimeout(timer);
  }, [canvasReady, phase]);

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
          className={`loader-screen ${phase === "docking" ? "loader-screen-leaving" : ""}`}
        >
          <span className="sr-only">Loading page</span>
        </div>
      )}
      <header className="pointer-events-none fixed inset-x-0 top-0 z-60 h-24" aria-label="Site header">
        <Link
          href="/"
          aria-label="Ziova home"
          tabIndex={loading ? -1 : 0}
          className={`ziova-logo ziova-logo-${phase}`}
          onAnimationEnd={() => {
            if (phase === "entering") setPhase("center");
          }}
          onTransitionEnd={(event) => {
            if (event.propertyName === "transform" && phase === "docking") {
              setPhase("settled");
            }
          }}
        >
          <Image
            src="/eye.png"
            alt=""
            width={192}
            height={192}
            preload
            className="h-full w-full rounded-full object-cover"
          />
        </Link>
      </header>
    </>
  );
}
