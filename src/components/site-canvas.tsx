"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PixelLiquidBg } from "@/components/ui/pixel-liquid-bg";
import { ProducerPortfolio } from "@/components/producer-portfolio";

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
    <div id="top">
      <div className="site-fluid" aria-hidden="true">
        <PixelLiquidBg pixelSize={8} onReady={handleReady} />
      </div>
      <main
        aria-busy={loading}
        inert={loading}
        className="portfolio-main"
      >
        <ProducerPortfolio />
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
      <header className={`site-header ${loading ? "site-header-loading" : ""}`} aria-label="Site header">
        <nav className="header-nav header-nav-left" aria-label="Main navigation" inert={loading}>
          <a href="#beats">Beats</a><a href="#loops">Loops</a>
        </nav>
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
            src="/eye transparent.png"
            alt=""
            width={192}
            height={192}
            preload
            className="h-full w-full object-contain"
          />
        </Link>
        <nav className="header-nav header-nav-right" aria-label="Contact navigation" inert={loading}>
          <a className="header-about" href="#about">About</a><a href="#contact">Let’s work <span aria-hidden="true">↗</span></a>
        </nav>
      </header>
    </div>
  );
}
