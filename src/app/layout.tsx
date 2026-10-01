import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/Providers";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FieldOps AI — Supervisión Inteligente de Servicios en Campo",
  description:
    "PWA offline-first para supervisores, panel de control de operaciones y chatbot con Gemini Vision.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "FieldOps AI" },
};

export const viewport: Viewport = {
  themeColor: "#030712",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-surface text-on-surface">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
