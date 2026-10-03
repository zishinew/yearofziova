"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { BEAT_PRICE_CAD, type Beat } from "@/data/beats";

type Item = Pick<Beat, "id" | "title">;
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
      return parsed.filter((item): item is Item => item && typeof item.id === "string" && typeof item.title === "string")
        .filter((item, i, all) => all.findIndex(other => other.id === item.id) === i);
    } catch { return []; }
  }, [raw]);
  const [opened, setOpened] = useState(false);
  const [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  function write(next: Item[]) {
    try { localStorage.setItem(key, JSON.stringify(next)); window.dispatchEvent(new Event(changed)); setError(""); }
    catch { setError("Couldn't save your cart. Please allow browser storage and try again."); setOpened(true); }
  }
  useEffect(() => {
    if (!opened) return;
    const element = dialog.current;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    return () => { element?.close(); document.body.style.overflow = overflow; };
  }, [opened]);
  return <CartContext.Provider value={{ items, add: beat => {
    if (!items.some(item => item.id === beat.id)) write([...items, { id: beat.id, title: beat.title }]);
  }, remove: id => write(items.filter(item => item.id !== id)), open: () => setOpened(true) }}>
    {children}
    {opened && <dialog ref={dialog} className="cart-dialog" aria-labelledby="cart-title" onCancel={event => { event.preventDefault(); setOpened(false); }}>
      <div className="cart-heading"><h2 id="cart-title">Your cart</h2><button type="button" aria-label="Close cart" onClick={() => setOpened(false)}>×</button></div>
      {items.length ? <><ul className="cart-items">{items.map(item => <li key={item.id}><div><p>{item.title}</p><span>{money(Math.round(BEAT_PRICE_CAD * 100))}</span></div><button type="button" aria-label={`Remove ${item.title} from cart`} onClick={() => write(items.filter(other => other.id !== item.id))}>Remove</button></li>)}</ul>
        <div className="cart-total"><span>Total</span><span>{money(items.length * Math.round(BEAT_PRICE_CAD * 100))}</span></div>
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
