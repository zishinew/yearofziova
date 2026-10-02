"use server";

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; message?: string };

function credentials(form: FormData) {
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  return { email, password };
}

function validEmail(email: string) {
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function callback(next = "/account") {
  const origin = process.env.SITE_URL || (process.env.NODE_ENV === "production" ? "https://yearofziova.com" : "http://localhost:3000");
  const url = new URL("/auth/callback", origin);
  url.searchParams.set("next", next);
  return url.toString();
}

export async function login(_state: AuthState, form: FormData): Promise<AuthState> {
  const { email, password } = credentials(form);
  if (!validEmail(email) || !password || password.length > 128) return { error: "Enter your email and password." };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { error: "Accounts are not available yet." };
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Couldn't sign in. Check your email and password, and make sure your email is confirmed." };
  redirect("/account");
}

export async function signup(_state: AuthState, form: FormData): Promise<AuthState> {
  const { email, password } = credentials(form);
  if (!validEmail(email) || password.length < 8 || password.length > 128) return { error: "Use a valid email and a password with at least 8 characters." };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { error: "Accounts are not available yet." };
  const { data, error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: callback() } });
  if (error) return { error: "Couldn't create your account. Please try again later." };
  if (data.session) redirect("/account");
  return { message: "Check your email to confirm your account. After that, sign in here anytime to download your purchases." };
}

export async function resetPassword(_state: AuthState, form: FormData): Promise<AuthState> {
  const { email } = credentials(form);
  if (!validEmail(email)) return { error: "Enter a valid email address." };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { error: "Accounts are not available yet." };
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: callback("/account/password") });
  return { message: "If an account exists for this email, you'll receive a password reset link." };
}

export async function updatePassword(_state: AuthState, form: FormData): Promise<AuthState> {
  const { password } = credentials(form);
  if (password.length < 8 || password.length > 128) return { error: "Use a password with at least 8 characters." };
  if (password !== String(form.get("confirmPassword") || "")) return { error: "Your passwords don't match." };
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { error: "Accounts are not available yet." };
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your reset link has expired. Request a new one." };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: "Couldn't update your password. Please request a new reset link." };
  redirect("/account");
}

export async function logout() {
  const supabase = await createServerSupabaseClient();
  if (supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) redirect("/account?error=signout");
  }
  redirect("/login");
}
