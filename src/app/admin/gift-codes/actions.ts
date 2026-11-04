"use server";

import { revalidatePath } from "next/cache";
import { getAdminSession } from "@/lib/supabase/admin";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { giftCodeHash, newGiftCode } from "@/lib/gift-code";
import { UUID } from "@/lib/track-upload";

export async function createGiftCode(_previous: { code?: string; error?: string }, form: FormData): Promise<{ code?: string; error?: string }> {
  if (!await getAdminSession()) return { error: "Admin access required." };
  const label = String(form.get("label") || "").trim();
  if (!label || label.length > 80) return { error: "Enter a label of up to 80 characters." };
  const code = newGiftCode();
  const { error } = await createServiceSupabaseClient().from("gift_codes").insert({ label, code_hash: giftCodeHash(code) });
  if (error) return { error: "Couldn't create the gift code. Please try again." };
  revalidatePath("/admin/gift-codes");
  return { code };
}

export async function revokeGiftCode(_previous: string, form: FormData) {
  if (!await getAdminSession()) return "Admin access required.";
  const id = String(form.get("id") || "");
  if (!UUID.test(id)) return "Invalid gift code.";
  const { error } = await createServiceSupabaseClient().from("gift_codes").update({ revoked_at: new Date().toISOString() }).eq("id", id).is("revoked_at", null);
  if (error) return "Couldn't revoke the gift code. Please try again.";
  revalidatePath("/admin/gift-codes");
  return "";
}
