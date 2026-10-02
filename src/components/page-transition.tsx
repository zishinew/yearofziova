"use client";

import { ViewTransition, type ReactNode } from "react";
import { usePathname } from "next/navigation";

export function PageTransition({ children, view }: { children: ReactNode; view?: string }) {
  const pathname = usePathname();
  return (
    <ViewTransition key={view || pathname} name="page-content" share="page-motion" enter="page-motion" exit="page-motion" default="none">
      {children}
    </ViewTransition>
  );
}
