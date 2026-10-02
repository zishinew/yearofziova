"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { PixelLiquidBg } from "@/components/ui/pixel-liquid-bg";
import { BeatCatalog } from "@/components/beat-catalog";
import { BeatVault } from "@/components/beat-vault";

export function SiteCanvas() {
  const [canvasReady, setCanvasReady] = useState(false);
  const [view, setView] = useState<"home" | "beats" | "loops">("home");
  const [phase, setPhase] = useState<"entering" | "center" | "docking" | "settled">("entering");
  const handleReady = useCallback(() => setCanvasReady(true), []);
  const loading = phase !== "settled";

  useEffect(() => {
    if (!canvasReady || phase !== "center") return;
    const timer = window.setTimeout(() => setPhase("docking"), 250);
    return () => window.clearTimeout(timer);
  }, [canvasReady, phase]);

  return (
    <div id="top">
      <div className="site-fluid" aria-hidden="true">
        <PixelLiquidBg pixelSize={8} onReady={handleReady} />
      </div>
      <main
        aria-busy={loading}
        inert={loading}
        className={view === "home" ? "vault-landing" : "vault-content"}
      >
        {view === "home" ? (
          <div className="vault-choices">
            <button type="button" onClick={() => setView("beats")}>Beat Vault</button>
            <button type="button" onClick={() => setView("loops")}>Loop Kit</button>
          </div>
        ) : view === "beats" ? <BeatVault /> : <BeatCatalog kind="loops" />}
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
      <header className={`vault-header ${loading ? "vault-header-loading" : ""}`} aria-label="Site header">
        {view !== "home" && !loading && (
          <button type="button" className="vault-back" onClick={() => setView("home")}>
            <span aria-hidden="true">←</span> Back
          </button>
        )}
        <button
          type="button"
          aria-label="Ziova home"
          disabled={loading}
          onClick={() => setView("home")}
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
            src="/eye transparent.png"
            alt=""
            width={192}
            height={192}
            preload
            className="h-full w-full object-contain"
          />
        </button>
      </header>
    </div>
  );
}
