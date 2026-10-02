import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const requestedNext = request.nextUrl.searchParams.get("next");
  const next = requestedNext === "/account/password" || type === "recovery" ? "/account/password" : "/account";
  const supabase = await createServerSupabaseClient();
  if (supabase) {
    const result = code
      ? await supabase.auth.exchangeCodeForSession(code)
      : tokenHash && (type === "email" || type === "signup" || type === "recovery")
        ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
        : null;
    if (result && !result.error) {
      return NextResponse.redirect(new URL(next, request.url), { headers: { "Cache-Control": "private, no-store" } });
    }
  }
  return NextResponse.redirect(new URL("/login?error=confirmation", request.url), { headers: { "Cache-Control": "private, no-store" } });
}
