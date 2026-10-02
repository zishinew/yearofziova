import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ziova — Beats & Original Production",
  description: "Beats and original production by ziova. Explore the sounds, discover the producer, and connect with @yearofziova.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
