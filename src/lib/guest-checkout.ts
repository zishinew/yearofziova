import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const guestCookieName = (id: string) => `ziova-guest-${id}`;
export const guestTokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export const newGuestToken = () => randomBytes(32).toString("hex");
export async function ownsOrder(order: { id: string; user_id: string | null; guest_token_hash: string | null }, userId?: string) {
  if (userId && order.user_id === userId) return true;
  const token = (await cookies()).get(guestCookieName(order.id))?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token) || !order.guest_token_hash || !/^[a-f0-9]{64}$/.test(order.guest_token_hash)) return false;
  return timingSafeEqual(Buffer.from(guestTokenHash(token), "hex"), Buffer.from(order.guest_token_hash, "hex"));
}
