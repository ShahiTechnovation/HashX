import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import "./globals.css";

// Self-hosted at build time: no external stylesheet, no fallback flash.
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-space-grotesk", display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono", display: "swap" });

export const metadata: Metadata = {
  title: {
    default: "HashX — The Trust Layer for Agent Payments",
    template: "%s · HashX",
  },
  icons: {
    icon: "/icon.png",
    shortcut: "/icon.png",
    apple: "/apple-icon.png",
  },
  description:
    "HashX verifies commercial intent, authenticates structured invoices, validates objective fulfillment, enforces two-stage human authorization, reconciles HSP settlement, and anchors evidence for verifiable receipts.",
  keywords: [
    "Agent Payments",
    "Agentic Commerce",
    "Payment Authorization",
    "HashKey Chain",
    "HSP",
    "EIP-712",
    "Verifiable Receipts",
  ],
  authors: [{ name: "HashX" }],
  openGraph: {
    title: "HashX — The Trust Layer for Agent Payments",
    description:
      "Verify commercial intent. Validate fulfillment. Authorize exact payments. Prove settlement.",
    url: "https://hashx.global",
    siteName: "HashX",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HashX — The Trust Layer for Agent Payments",
    description: "Verify commercial intent. Validate fulfillment. Authorize exact payments. Prove settlement.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#0A1012",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-primary/25 selection:text-foreground">
        {children}
      </body>
    </html>
  );
}
