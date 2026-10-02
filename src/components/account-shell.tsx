import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageTransition } from "@/components/page-transition";

export function AccountShell({ children }: { children: ReactNode }) {
  return (
    <>
      <header className="account-header">
        <Link href="/" className="account-back">← Back</Link>
        <Link href="/" aria-label="Ziova home" className="account-logo">
          <Image src="/eye transparent.png" alt="" width={96} height={96} className="h-full w-full object-contain" />
        </Link>
      </header>
      <PageTransition><main className="account-content">{children}</main></PageTransition>
    </>
  );
}
