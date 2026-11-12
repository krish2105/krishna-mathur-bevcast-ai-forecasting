import type { Metadata, Viewport } from "next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { AppShell } from "@/components/layout/app-shell";
import { Providers } from "@/components/layout/providers";
import { part2 } from "@/lib/data/reference";
import { monthLabel } from "@/lib/format";
import "katex/dist/katex.min.css";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://bevcast-ai.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "BEVCAST AI · Demand-Forecasting Studio", template: "%s · BEVCAST AI" },
  description:
    "AI in Operations: demand-forecasting studio for air coolers and flavored water. Naïve vs ML with MAPE and WAPE, a 3-month forecast and a tool-calling LLM copilot on live data.",
  applicationName: "BEVCAST AI",
  authors: [{ name: "Krishna Mathur" }],
  keywords: ["demand forecasting", "MAPE", "WAPE", "XGBoost", "SARIMA", "Holt-Winters", "AI in Operations"],
  openGraph: {
    type: "website",
    title: "BEVCAST AI · Demand-Forecasting Studio",
    description: "Forecast better. Produce smarter. Distribute with confidence.",
    siteName: "BEVCAST AI",
  },
  twitter: { card: "summary_large_image", title: "BEVCAST AI", description: "Forecast better. Produce smarter. Distribute with confidence." },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f9fc" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1220" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const freshness = `Reference: notebook run 12 Nov 2026 · FRED to ${monthLabel(part2.series.window.to)}`;
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable} antialiased`} suppressHydrationWarning>
      <body>
        <Providers>
          <AppShell freshness={freshness}>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
