import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import { SkipLink } from "@/components/layout/skip-link";
import { getAppBaseUrlFromEnv } from "@/lib/app-url";
import "./globals.css";

const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-sans-display",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim();

export const metadata: Metadata = {
  metadataBase: new URL(getAppBaseUrlFromEnv()),
  title: {
    default: "Oblixa — Track renewals, obligations, and owners from signed contracts",
    template: "%s — Oblixa",
  },
  description:
    "Oblixa replaces contract tracking spreadsheets with a workspace for reviewed terms, key dates, assigned owners, obligation follow-up, evidence, and reports.",
  applicationName: "Oblixa",
  openGraph: {
    type: "website",
    siteName: "Oblixa",
    locale: "en_US",
    title: "Oblixa — Track renewals, obligations, and owners from signed contracts",
    description:
      "Oblixa replaces contract tracking spreadsheets with a workspace for reviewed terms, key dates, assigned owners, obligation follow-up, evidence, and reports.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "Oblixa — Contract tracking workspace for renewals, owners, obligations, evidence, and reports" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Oblixa — Track renewals, obligations, and owners from signed contracts",
    description:
      "Oblixa replaces contract tracking spreadsheets with a workspace for reviewed terms, key dates, assigned owners, obligation follow-up, evidence, and reports.",
    images: ["/twitter-image"],
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  ...(siteVerification ? { verification: { google: siteVerification } } : {}),
  icons: {
    icon: [{ url: "/icon", type: "image/png" }],
    shortcut: [{ url: "/icon", type: "image/png" }],
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f8fb" },
    { media: "(prefers-color-scheme: dark)", color: "#161a23" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${plusJakarta.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="relative flex min-h-full flex-col font-sans text-[var(--text-secondary)]">
        <SkipLink />
        {children}
      </body>
    </html>
  );
}
