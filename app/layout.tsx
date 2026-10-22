import type { Metadata, Viewport } from "next";
import "@fontsource-variable/space-grotesk";
import "@fontsource-variable/inter";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "PyFun — belajar Python lewat game", template: "%s · PyFun" },
  description: "Belajar Python dari nol lewat quest singkat, XP, streak, dan boss. Semua progres tersimpan di perangkatmu.",
  icons: { icon: "/image/logo.png" },
};

export const viewport: Viewport = { themeColor: "#131314", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
