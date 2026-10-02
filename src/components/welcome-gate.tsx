"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";

export function WelcomeGate({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  if (!isOpen) return children;

  return (
    <dialog
      ref={dialogRef}
      aria-label="Ziova says hi"
      aria-describedby="welcome-instructions"
      onClose={() => setIsOpen(false)}
      className="welcome-dialog"
    >
      <button
        type="button"
        aria-label="Dismiss welcome and enter the site"
        className="absolute inset-0 cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-8 focus-visible:outline-pink-400"
        onClick={() => dialogRef.current?.close()}
      />

      <div className="pointer-events-none absolute bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-[max(1.5rem,env(safe-area-inset-left))] sm:bottom-8 sm:left-8">
        <div className="pointer-events-auto relative w-52">
          <Image
            src="/ziova.jpg"
            alt="Ziova"
            width={72}
            height={72}
            preload
            className="h-18 w-18 rounded-full object-cover shadow-[0_6px_20px_rgba(0,0,0,0.18)]"
          />
          <div className="absolute bottom-12 left-20 h-20 w-28">
            <svg
              viewBox="0 0 112 80"
              aria-hidden="true"
              className="absolute inset-0 h-full w-full"
              shapeRendering="crispEdges"
            >
              <path
                d="M16 4H100V8H104V12H108V60H104V64H24V68H20V72H16V76H8V64H4V12H8V8H16Z"
                fill="white"
                stroke="#171717"
                strokeWidth="4"
              />
            </svg>
            <span className="absolute inset-x-0 top-4 text-center font-mono text-3xl font-bold tracking-tight">
              hi
            </span>
          </div>
        </div>
        <p
          id="welcome-instructions"
          className="mt-5 font-mono text-xs tracking-wide text-neutral-400"
        >
          click outside to enter
        </p>
      </div>
    </dialog>
  );
}
