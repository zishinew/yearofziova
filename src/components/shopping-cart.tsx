"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { BEAT_PRICE_CAD, type Beat } from "@/data/beats";

type Lease = "mp3" | "wav";
type Item = Pick<Beat, "id" | "title"> & { lease: Lease };
const prices: Record<Lease, number> = { mp3: Math.round(BEAT_PRICE_CAD * 100), wav: 3500 };
const leaseName = (lease: Lease) => `${lease.toUpperCase()} lease`;
const key = "ziova-cart-v1";
const changed = "ziova-cart-changed";
function snapshot() { try { return localStorage.getItem(key) || "[]"; } catch { return "[]"; } }
function subscribe(callback: () => void) {
  window.addEventListener("storage", callback); window.addEventListener(changed, callback);
  return () => { window.removeEventListener("storage", callback); window.removeEventListener(changed, callback); };
}
const CartContext = createContext<{ items: Item[]; add: (beat: Beat) => void; remove: (id: string) => void; open: () => void }>({ items: [], add: () => {}, remove: () => {}, open: () => {} });
const money = (cents: number) => `$${(cents / 100).toFixed(2)} CAD`;

export function ShoppingCart({ children }: { children: ReactNode }) {
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
  const [selection, setSelection] = useState<Pick<Beat, "id" | "title"> | null>(null);
  const [lease, setLease] = useState<Lease>("mp3");
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  function write(next: Item[]) {
    try { localStorage.setItem(key, JSON.stringify(next)); window.dispatchEvent(new Event(changed)); setError(""); return true; }
    catch { setError("Couldn't save your cart. Please allow browser storage and try again."); setOpened(true); return false; }
  }
  function choose(beat: Pick<Beat, "id" | "title">) {
    setSelection(beat);
    setLease(items.find(item => item.id === beat.id)?.lease || "mp3");
    setError("");
    setOpened(true);
  }
  useEffect(() => {
    if (!opened) return;
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    return () => { element?.close(); document.body.style.overflow = overflow; };
  }, [opened]);
  const existing = selection ? items.some(item => item.id === selection.id) : false;
  return <CartContext.Provider value={{ items, add: choose, remove: id => write(items.filter(item => item.id !== id)), open: () => { setSelection(null); setError(""); setOpened(true); } }}>
    {children}
    {opened && <dialog ref={dialog} className="cart-dialog" aria-labelledby="cart-title" onCancel={event => { event.preventDefault(); setOpened(false); }}>
      <div className="cart-heading"><h2 id="cart-title">{selection ? "Choose your lease" : "Your cart"}</h2><button type="button" aria-label={selection ? "Close lease picker" : "Close cart"} onClick={() => setOpened(false)}>×</button></div>
      {selection ? <>
        <p className="lease-track-title">{selection.title}</p>
        <fieldset className="lease-options"><legend className="sr-only">Lease format</legend>
          {(["mp3", "wav"] as const).map(option => <label key={option} className="lease-option"><input type="radio" name="lease" value={option} checked={lease === option} onChange={() => setLease(option)} /><span>{leaseName(option)}</span><span>{money(prices[option])}</span></label>)}
        </fieldset>
        <button type="button" className="lease-confirm" onClick={() => {
          const next: Item = { id: selection.id, title: selection.title, lease };
          const updated = existing ? items.map(item => item.id === selection.id ? next : item) : [...items, next];
          if (write(updated)) setOpened(false);
        }}>{existing ? "Update lease" : "Add to cart"} · {money(prices[lease])}</button>
        <a className="lease-exclusive" href="https://www.instagram.com/yearofziova/" target="_blank" rel="noreferrer"><span>Exclusive lease</span><span>DM @yearofziova ↗</span></a>
      </> : items.length ? <><ul className="cart-items">{items.map(item => <li key={item.id}><div><p>{item.title}</p><span>{leaseName(item.lease)} · {money(prices[item.lease])}</span><button type="button" className="cart-change-lease" aria-label={`Change lease for ${item.title}`} onClick={() => choose(item)}>Change lease</button></div><button type="button" aria-label={`Remove ${item.title} from cart`} onClick={() => write(items.filter(other => other.id !== item.id))}>Remove</button></li>)}</ul>
        <div className="cart-total"><span>Total</span><span>{money(items.reduce((total, item) => total + prices[item.lease], 0))}</span></div>
        <p className="cart-note">DM @yearofziova on Instagram to purchase the beats in your cart.</p>
        <a className="cart-inquiry" href="https://www.instagram.com/yearofziova/" target="_blank" rel="noreferrer">Inquire on Instagram ↗</a>
      </> : <p className="cart-note">Your cart is empty.</p>}
      {error && <p className="auth-error" role="alert">{error}</p>}
    </dialog>}
  </CartContext.Provider>;
}
export function useCart() { return useContext(CartContext); }
export function CartButton() {
  const cart = useCart();
  return <button type="button" className="header-cart" onClick={cart.open}>Cart ({cart.items.length})</button>;
}
