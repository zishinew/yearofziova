"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { login, signup, resetPassword, updatePassword, type AuthState } from "@/app/auth/actions";

type Mode = "login" | "signup" | "reset" | "password";
const actions = { login, signup, reset: resetPassword, password: updatePassword };
const labels = { login: "Sign in", signup: "Create account", reset: "Reset password", password: "Set new password" };

function Form({ mode, configured, onReset }: { mode: Mode; configured: boolean; onReset: () => void }) {
  const [state, action, pending] = useActionState(actions[mode], {} as AuthState);
  return (
    <form action={action} className="auth-form">
      {mode !== "password" && <label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} /></label>}
      {mode !== "reset" && <label>{mode === "password" ? "New password" : "Password"}
        <input name="password" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"}
          required minLength={mode === "login" ? 1 : 8} maxLength={128} />
      </label>}
      {mode === "password" && <label>Confirm password<input name="confirmPassword" type="password" autoComplete="new-password" required minLength={8} maxLength={128} /></label>}
      {state.error && <p className="auth-error" role="alert">{state.error}</p>}
      {state.message && <p className="auth-message" role="status">{state.message}</p>}
      {!configured && <p className="auth-message">Accounts are coming soon.</p>}
      <button className="auth-submit" type="submit" disabled={pending || !configured}>{pending ? "Please wait…" : labels[mode]}</button>
      {mode === "login" && <button className="auth-text-link auth-reset" type="button" onClick={onReset}>Forgot password?</button>}
    </form>
  );
}

export function AuthForm({ configured, mode: initialMode = "login", confirmationError = false }: { configured: boolean; mode?: Mode; confirmationError?: boolean }) {
  const [mode, setMode] = useState(initialMode);
  return (
    <div className="auth-card">
      <h1 id="auth-title">{labels[mode]}</h1>
      <p className="auth-intro">{mode === "reset" ? "We'll send you a link to set a new password." : mode === "password" ? "Choose a new password for your account." : "Your purchased beats. Always here."}</p>
      {confirmationError && <p className="auth-error" role="alert">That confirmation link has expired or was opened in a different browser. Try signing in, or request a password reset.</p>}
      <Form key={mode} mode={mode} configured={configured} onReset={() => setMode("reset")} />
      {(mode === "login" || mode === "signup") ? (
        <button className="auth-switch" type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
          {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      ) : mode === "reset" ? <button className="auth-switch" type="button" onClick={() => setMode("login")}>Back to sign in</button> : <Link className="auth-text-link" href="/login">Back to sign in</Link>}
    </div>
  );
}
