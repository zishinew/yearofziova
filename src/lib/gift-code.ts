import "server-only";
import { createHash, randomBytes } from "node:crypto";

export const newGiftCode = () => `ZIOVA-${randomBytes(16).toString("hex").toUpperCase()}`;
export const normalizeGiftCode = (code: string) => code.trim().toUpperCase();
export const giftCodeHash = (code: string) => createHash("sha256").update(normalizeGiftCode(code)).digest("hex");
export const isGiftCode = (code: string) => /^ZIOVA-[A-F0-9]{32}$/.test(normalizeGiftCode(code));
