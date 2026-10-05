export function stripeKeyMode(key: string | undefined): "test" | "live" | null {
  const match = /^(?:sk|rk)_(test|live)_[A-Za-z0-9_]+$/.exec(key || "");
  return match ? match[1] as "test" | "live" : null;
}
