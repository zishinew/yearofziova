export type Lease = "mp3" | "wav";
export const LEASE_PRICES = { mp3: 2499, wav: 3499 } as const;
export type CheckoutItem = { id: string; lease: Lease };
export function parseCheckoutItems(value: unknown): CheckoutItem[] | null {
  if (!Array.isArray(value) || !value.length || value.length > 30) return null;
  const items: CheckoutItem[] = [];
  for (const item of value) {
    if (!item || typeof item.id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(item.id)
      || (item.lease !== "mp3" && item.lease !== "wav") || items.some(other => other.id === item.id)) return null;
    items.push({ id: item.id, lease: item.lease });
  }
  return items;
}
