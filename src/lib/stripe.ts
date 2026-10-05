import "server-only";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";
import { stripeKeyMode } from "@/lib/stripe-mode";
export function paymentServices() {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const mode = stripeKeyMode(stripeKey);
  if (!stripeKey || !mode || !supabaseKey || !url) throw new Error("Payments are not configured.");
  if (process.env.VERCEL_ENV === "preview" && mode !== "test") {
    throw new Error("Preview deployments require sandbox Stripe credentials.");
  }
  // Live payments require an explicit deployment opt-in after sandbox verification.
  if (mode === "live" && process.env.STRIPE_LIVE_PAYMENTS !== "true") throw new Error("Live payments are not enabled.");
  return {
    stripe: new Stripe(stripeKey, { maxNetworkRetries: 2 }),
    db: createClient(url, supabaseKey, { auth: { persistSession: false, autoRefreshToken: false } }),
  };
}
export function siteOrigin() {
  const origin = new URL(process.env.SITE_URL || "http://localhost:3000");
  if (origin.protocol !== "https:" && origin.hostname !== "localhost" && origin.hostname !== "127.0.0.1") throw new Error("Invalid site origin.");
  return origin.origin;
}
