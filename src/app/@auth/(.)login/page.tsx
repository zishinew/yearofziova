import { LoginPanel } from "@/components/login-panel";

export const dynamic = "force-dynamic";

export default function LoginModal({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return <LoginPanel searchParams={searchParams} intercepted />;
}
