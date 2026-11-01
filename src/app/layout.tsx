import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HashX Global — The Trust Layer for Agentic Commerce",
  description:
    "Cryptographic verification, deterministic fulfillment validation, exact human authorization, and reconciled HSP settlement on HashKey Chain.",
  keywords: [
    "Agentic Commerce",
    "HashKey Chain",
    "HSP",
    "EIP-712",
    "Deterministic Verification",
    "AI Agent Payments",
    "Smart Invoices",
  ],
  authors: [{ name: "HashX Global Protocol Team" }],
  openGraph: {
    title: "HashX Global — The Trust Layer for Agentic Commerce",
    description:
      "Verify commercial intent. Validate delivery. Authorize exact payments. Prove settlement.",
    url: "https://hashx.global",
    siteName: "HashX Global",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "HashX Global — The Trust Layer for Agentic Commerce",
    description: "The Trust Layer for Agentic Commerce on HashKey Chain.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0911",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased selection:bg-primary-subtle selection:text-primary-light">
        {children}
      </body>
    </html>
  );
}
