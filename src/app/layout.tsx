import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Self-hosted at build time: no external stylesheet, no layout shift from swapping.
const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

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
    "HashX verifies signed commercial intent, checks objective fulfillment evidence, requires explicit human payment authorization, and verifies settlement on-chain before issuing a receipt.",
  keywords: [
    "Agent Payments",
    "Agentic Commerce",
    "Payment Authorization",
    "EIP-712",
    "Model Context Protocol",
    "Verifiable Receipts",
  ],
  authors: [{ name: "HashX" }],
  openGraph: {
    title: "HashX — The Trust Layer for Agent Payments",
    description: "Before agents pay, demand proof. Verify agreements, prove delivery, approve exact terms, settle with confidence.",
    url: "https://hashx.global",
    siteName: "HashX",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HashX — The Trust Layer for Agent Payments",
    description: "Before agents pay, demand proof. Verify agreements, prove delivery, approve exact terms, settle with confidence.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#FAFAF8",
  width: "device-width",
  initialScale: 1,
};

// Marks the document as scripted before first paint so scroll-reveal styles never hide content for no-JS clients.
const JS_FLAG = "document.documentElement.classList.add('js')";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: JS_FLAG }} />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">{children}</body>
    </html>
  );
}
