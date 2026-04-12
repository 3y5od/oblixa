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
    default: "Oblixa — Contract Execution Platform",
    template: "%s — Oblixa",
  },
  description:
    "Turn signed contracts into tracked work, deadlines, approvals, obligations, and audit-ready evidence.",
  applicationName: "Oblixa",
  openGraph: {
    type: "website",
    siteName: "Oblixa",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  ...(siteVerification ? { verification: { google: siteVerification } } : {}),
  icons: {
    icon: [{ url: "/icon", type: "image/png" }],
    apple: [{ url: "/apple-icon", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#fafaf9",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="relative flex min-h-full flex-col font-sans">
        <SkipLink />
        {children}
      </body>
    </html>
  );
}
