import type { Metadata } from "next";
import { SiteSession } from "@/components/site-session";
import { AudioPlayer } from "@/components/audio-player";
import { ShoppingCart } from "@/components/shopping-cart";
import { AdminModeProvider } from "@/components/admin-mode";
import { getAdminSession } from "@/lib/supabase/admin";
import "./globals.css";

export const metadata: Metadata = {
  title: "ziova",
  applicationName: "ziova",
  icons: {
    icon: { url: "/icon?v=2", type: "image/png", sizes: "32x32" },
    shortcut: "/icon?v=2",
    apple: "/icon.png?v=2",
  },
  description: "Explore the Beat Vault and Loop Kit by ziova. Beats are $24.99 CAD. DM @yearofziova on Instagram for inquiries.",
};

export default async function RootLayout({
  children,
  auth,
}: Readonly<{ children: React.ReactNode; auth?: React.ReactNode }>) {
  const admin = await getAdminSession();
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body><SiteSession><AdminModeProvider isAdmin={Boolean(admin)}><ShoppingCart><AudioPlayer>{children}{auth}</AudioPlayer></ShoppingCart></AdminModeProvider></SiteSession></body>
    </html>
  );
}
