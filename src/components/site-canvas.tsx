"use client";

import Image from "next/image";
import Link from "next/link";
import { startTransition, useEffect, useState } from "react";
import { PageTransition } from "@/components/page-transition";
import { useSiteSession } from "@/components/site-session";
import { CartButton } from "@/components/shopping-cart";
import { SoundPlaylist } from "@/components/sound-playlist";
import { beats, loops, type Beat } from "@/data/beats";
import { useAdminMode } from "@/components/admin-mode";
import { watchIntroPhase, type IntroPhase } from "@/lib/intro-recovery";

export function SiteCanvas({ skipLoader = false, initialView = "home", beatTracks = beats, loopTracks = loops, catalogError = false }: {
  initialView?: "home" | "beats" | "loops";
  skipLoader?: boolean; beatTracks?: Beat[]; loopTracks?: Beat[]; catalogError?: boolean;
}) {
  const isAdmin = useAdminMode();
  const { entered, canvasReady } = useSiteSession();
  const [view, setView] = useState<"home" | "beats" | "loops">(initialView);
  const [phase, setPhase] = useState<IntroPhase>(skipLoader || entered ? "settled" : "entering");
  const loading = phase !== "settled";
  const navigate = (next: typeof view) => startTransition(() => setView(next));

  useEffect(() => {
    return watchIntroPhase(phase, canvasReady, next => {
      setPhase(current => current === phase ? next : current);
    });
  }, [canvasReady, phase]);

  return (
    <div id="top">
      <PageTransition view={view}>
        <main
          aria-busy={loading}
          inert={loading}
          className={view === "home" ? "vault-landing" : "vault-content"}
        >
          {view === "home" ? (
            <div className="vault-choices">
              <button type="button" onClick={() => navigate("beats")}>Beat Vault</button>
              <button type="button" onClick={() => navigate("loops")}>Loop Kit</button>
            </div>
          ) : <SoundPlaylist key={view} kind={view} tracks={view === "beats" ? beatTracks : loopTracks} loadError={catalogError} />}
        </main>
      </PageTransition>
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
        {!loading && <div className="header-actions"><CartButton /><Link href={isAdmin ? "/admin" : "/login"} scroll={false}>{isAdmin ? "Admin dashboard" : "Account"}</Link></div>}
        {view !== "home" && !loading && (
          <button type="button" className="vault-back" onClick={() => navigate("home")}>
            <span aria-hidden="true">←</span> Back
          </button>
        )}
        <button
          type="button"
          aria-label="Ziova home"
          aria-disabled={loading}
          onClick={() => { if (!loading) navigate("home"); }}
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
