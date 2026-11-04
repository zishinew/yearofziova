import "server-only";
import { createHash } from "node:crypto";

export const normalizeGiftCode = (code: string) => code.trim().toUpperCase();
export const giftCodeHash = (code: string) => createHash("sha256").update(normalizeGiftCode(code)).digest("hex");
export const isGiftCode = (code: string) => /^[A-Z0-9][A-Z0-9_-]{7,47}$/.test(normalizeGiftCode(code));
