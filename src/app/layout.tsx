import type { Metadata } from "next";
import { SiteSession } from "@/components/site-session";
import { AudioPlayer } from "@/components/audio-player";
import { ShoppingCart } from "@/components/shopping-cart";
import "./globals.css";

export const metadata: Metadata = {
  title: "ziova",
  applicationName: "ziova",
  icons: { icon: { url: "/icon.png", type: "image/png" }, apple: "/icon.png" },
  description: "Explore the Beat Vault and Loop Kit by ziova. Beats are $24.99 CAD. DM @yearofziova on Instagram for inquiries.",
};

export default function RootLayout({
  children,
  auth,
}: Readonly<{ children: React.ReactNode; auth?: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body><SiteSession><ShoppingCart><AudioPlayer>{children}{auth}</AudioPlayer></ShoppingCart></SiteSession></body>
    </html>
  );
}
