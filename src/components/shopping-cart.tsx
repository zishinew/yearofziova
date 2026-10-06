"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { type Beat } from "@/data/beats";
import { LEASE_PRICES, type CheckoutItem } from "@/lib/payments";
import { useOwnedLeases } from "@/components/use-owned-leases";
import Link from "next/link";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { useAdminMode } from "@/components/admin-mode";
import { SuccessNotification } from "@/components/success-notification";

type Lease = "mp3" | "wav";
type Item = Pick<Beat, "id" | "title"> & { lease: Lease };
const prices = LEASE_PRICES;
const leaseName = (lease: Lease) => `${lease.toUpperCase()} lease`;
const key = "ziova-cart-v1";
const changed = "ziova-cart-changed";
function snapshot() { try { return localStorage.getItem(key) || "[]"; } catch { return "[]"; } }
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback); window.addEventListener(changed, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(changed, callback); };
}
const CartContext = createContext<{ items: Item[]; owns: (id: string, lease?: Lease) => boolean; ownershipReady: boolean; add: (beat: Beat) => void; remove: (id: string) => void; open: () => void }>({ items: [], owns: () => false, ownershipReady: false, add: () => {}, remove: () => {}, open: () => {} });
const money = (cents: number) => `$${(cents / 100).toFixed(2)} CAD`;

export function clearPurchasedCartItems(purchased: CheckoutItem[]) {
  try {
    const raw = JSON.parse(snapshot());
    if (!Array.isArray(raw)) return;
    localStorage.setItem(key, JSON.stringify(raw.filter(item => !purchased.some(p => p.id === item.id && p.lease === (item.lease || "mp3")))));
    window.dispatchEvent(new Event(changed));
  } catch {}
}

export function ShoppingCart({ children }: { children: ReactNode }) {
  const isAdmin = useAdminMode();
  const [email, setEmail] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    const client = createBrowserSupabaseClient();
    void client?.auth.getUser().then(({ data: { user } }) => { setSignedIn(!!user); if (user?.email) setEmail(user.email); });
  }, []);
  const ownership = useOwnedLeases();
  const owns = (id: string, format?: Lease) => ownership.items.some(item => item.id === id && (!format || item.lease === format));
  useEffect(() => { if (ownership.ready && ownership.items.length) clearPurchasedCartItems(ownership.items); }, [ownership]);
  const [checkingOut, setCheckingOut] = useState(false);
  const raw = useSyncExternalStore(subscribe, snapshot, () => "[]");
  const items = useMemo<Item[]>(() => {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter(item => item && typeof item.id === "string" && typeof item.title === "string" && (item.lease === undefined || item.lease === "mp3" || item.lease === "wav"))
        .map((item): Item => ({ id: item.id, title: item.title, lease: item.lease ?? "mp3" }))
        .filter((item, i, all) => all.findIndex(other => other.id === item.id) === i);
    } catch { return []; }
  }, [raw]);
  const [opened, setOpened] = useState(false);
  const [notification, setNotification] = useState<Item | null>(null);
  const [selection, setSelection] = useState<Pick<Beat, "id" | "title"> | null>(null);
  const [lease, setLease] = useState<Lease>("mp3");
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  function openCart() {
    if (isAdmin) return;
    setNotification(null);
    setSelection(null);
    setError("");
    setOpened(true);
  }
  function write(next: Item[]) {
    try { localStorage.setItem(key, JSON.stringify(next)); window.dispatchEvent(new Event(changed)); setError(""); return true; }
    catch { setError("Couldn't save your cart. Please allow browser storage and try again."); setOpened(true); return false; }
  }
  function choose(beat: Pick<Beat, "id" | "title">) {
    if (isAdmin) return;
    setNotification(null);
    setSelection(beat);
    setLease(items.find(item => item.id === beat.id)?.lease || "mp3");
    setError("");
    setOpened(true);
  }
  useEffect(() => {
    if (!opened || isAdmin) return;
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    return () => { element?.close(); document.body.style.overflow = overflow; };
  }, [opened, isAdmin]);
  async function checkout(checkoutItems: Item[] = items) {
    if (isAdmin) return;
    if (checkingOut) return;
    setCheckingOut(true); setError("");
    try {
      const response = await fetch("/api/checkout", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({email,items:checkoutItems.map(({id,lease})=>({id,lease}))}) });
      const result = await response.json();

      if (!response.ok || !result.url) throw new Error(result.error || "Couldn't start checkout.");
      window.location.assign(result.url);
    } catch (problem) { setError(problem instanceof Error ? problem.message : "Couldn't start checkout."); }
    finally { setCheckingOut(false); }
  }
  const available = (["mp3", "wav"] as const).filter(option => !selection || !owns(selection.id, option));
  const selectedLease = available.includes(lease) ? lease : available[0];
  const upgrading = selection ? owns(selection.id) : false;
  const existing = selection ? items.some(item => item.id === selection.id) : false;
  return <CartContext.Provider value={{ items, owns, ownershipReady: ownership.ready, add: choose, remove: id => write(items.filter(item => item.id !== id)), open: openCart }}>
    {children}
    {notification && !opened && !isAdmin && <SuccessNotification key={`${notification.id}-${notification.lease}`} message={<>Added <strong>{notification.title}</strong> to cart</>} action={<button type="button" className="cart-notification-view" onClick={openCart}>View cart ↗</button>} onDismiss={() => setNotification(null)} />}
    {opened && !isAdmin && <dialog ref={dialog} className="cart-dialog" aria-labelledby="cart-title" onCancel={event => { event.preventDefault(); setOpened(false); }}>
      <div className="cart-heading"><h2 id="cart-title">{selection ? upgrading ? "Upgrade your lease" : "Choose your lease" : "Your cart"}</h2><button type="button" aria-label={selection ? "Close lease picker" : "Close cart"} onClick={() => setOpened(false)}>×</button></div>
      {selection ? <>
        <p className="lease-track-title">{selection.title}</p>
        <fieldset className="lease-options"><legend className="sr-only">Lease format</legend>
          {(["mp3", "wav"] as const).map(option => <label key={option} className={`lease-option ${owns(selection.id, option) ? "lease-option-owned" : ""}`}><input type="radio" name="lease" value={option} checked={selectedLease === option} disabled={checkingOut || !ownership.ready || owns(selection.id, option)} onChange={() => setLease(option)} /><span>{leaseName(option)}</span><span>{owns(selection.id, option) ? "Owned ✓" : money(prices[option])}</span></label>)}
        </fieldset>
        <button type="button" className="lease-confirm" disabled={checkingOut || !ownership.ready || !selectedLease} onClick={() => {
          if (!selectedLease || owns(selection.id, selectedLease)) return;
          const next: Item = { id: selection.id, title: selection.title, lease: selectedLease };
          if (upgrading) { void checkout([next]); return; }
          const updated = existing ? items.map(item => item.id === selection.id ? next : item) : [...items, next];
          if (write(updated)) {
            setOpened(false);
            if (!existing) setNotification(next);
          }
        }}>{checkingOut ? "Opening checkout…" : !ownership.ready ? "Checking ownership…" : !selectedLease ? "All leases owned" : `${upgrading ? "Upgrade lease" : existing ? "Update lease" : "Add to cart"} · ${money(prices[selectedLease])}`}</button>
        <a className="lease-exclusive" href="https://www.instagram.com/yearofziova/" target="_blank" rel="noreferrer"><span>Exclusive lease</span><span>DM @yearofziova ↗</span></a>
      </> : items.length ? <><ul className="cart-items">{items.map(item => <li key={item.id}><div><p>{item.title}</p><span>{leaseName(item.lease)} · {money(prices[item.lease])}</span><button type="button" className="cart-change-lease" aria-label={`${owns(item.id) ? "Upgrade" : "Change"} lease for ${item.title}`} onClick={() => choose(item)}>{owns(item.id) ? "Upgrade lease" : "Change lease"}</button></div><button type="button" aria-label={`Remove ${item.title} from cart`} onClick={() => write(items.filter(other => other.id !== item.id))}>Remove</button></li>)}</ul>
        <div className="cart-total"><span>Total</span><span>{money(items.reduce((total, item) => total + prices[item.lease], 0))}</span></div>
        <label className="checkout-email">Email<input type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" required /></label>
        <button className="lease-confirm" type="button" disabled={checkingOut} onClick={() => { void checkout(); }}>{checkingOut ? "Opening checkout…" : "Checkout ↗"}</button>
        <p className="cart-note">{signedIn ? "Purchases are saved to your account." : <>No account needed. <Link href="/login?signup=1" scroll={false} onClick={() => setOpened(false)}>Create an account</Link> for easier access to your beats on any device.</>}</p>
      </> : <p className="cart-note">Your cart is empty.</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
    </dialog>}
  </CartContext.Provider>;
}
export function useCart() { return useContext(CartContext); }
export function CartButton() {
  const cart = useCart();
  const isAdmin = useAdminMode();
  if (isAdmin) return null;
  return <button type="button" className="header-cart" onClick={cart.open}>Cart ({cart.items.length})</button>;
}
