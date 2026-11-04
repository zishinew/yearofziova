import "server-only";
import Stripe from "stripe";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { stripeKeyMode } from "@/lib/stripe-mode";
export function paymentServices() {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const mode = stripeKeyMode(stripeKey);
  if (!stripeKey || !mode) throw new Error("Payments are not configured.");
  // Live payments require an explicit deployment opt-in after sandbox verification.
  if (mode === "live" && process.env.STRIPE_LIVE_PAYMENTS !== "true") throw new Error("Live payments are not enabled.");
  return {
    stripe: new Stripe(stripeKey, { maxNetworkRetries: 2 }),
    db: createServiceSupabaseClient(),
  };
}
export function siteOrigin() {
  const origin = new URL(process.env.SITE_URL || "http://localhost:3000");
  if (origin.protocol !== "https:" && origin.hostname !== "localhost" && origin.hostname !== "127.0.0.1") throw new Error("Invalid site origin.");
  return origin.origin;
}
