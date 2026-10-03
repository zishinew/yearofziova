"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";

export function PageTransition({ children, view }: { children: ReactNode; view?: string }) {
  const pathname = usePathname();
  return (
    <div key={view || pathname} className="page-transition">
      {children}
    </div>
  );
}
