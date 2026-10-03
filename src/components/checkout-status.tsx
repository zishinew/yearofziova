"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { clearPurchasedCartItems } from "@/components/shopping-cart";
import type { CheckoutItem } from "@/lib/payments";
export function CheckoutStatus({ paid, pending, items }: { paid:boolean; pending:boolean; items:CheckoutItem[] }) {
  const router = useRouter();
  useEffect(()=>{
    if (paid) { clearPurchasedCartItems(items); return; }
    if (!pending) return;
    const timer = window.setInterval(()=>router.refresh(),3000);
    return ()=>window.clearInterval(timer);
  },[paid,pending,items,router]);
  return null;
}
