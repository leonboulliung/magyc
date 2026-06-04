import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import "./globals.css";

// Editorial appearance for every Clerk-rendered surface (modal, hosted pages,
// UserButton). Conservative — only `variables`, which Clerk applies via CSS
// custom properties and can't error on. Per-element class overrides removed
// because unknown element keys can crash some Clerk component versions.
const clerkAppearance = {
  variables: {
    colorPrimary: "#0a0a0a",
    colorText: "#0a0a0a",
    colorTextSecondary: "#5a5a5a",
    colorBackground: "#fafafa",
    colorInputBackground: "#ffffff",
    colorInputText: "#0a0a0a",
    colorDanger: "#7a1f1f",
    colorSuccess: "#225f3a",
    colorNeutral: "#0a0a0a",
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    fontFamilyButtons: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: "13px",
    borderRadius: "0px",
  },
};

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://creator-paris.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Creator.Paris — write what you want to do. The rest emerges.",
    template: "%s",
  },
  description:
    "A living city layer for Paris. Post a thing, share it, find your crew. The structure — roles, steps, place — emerges as people step in.",
  applicationName: "Creator.Paris",
  keywords: ["Paris", "meetups", "creators", "events", "city", "community"],
  openGraph: {
    type: "website",
    siteName: "Creator.Paris",
    title: "Creator.Paris — write what you want to do. The rest emerges.",
    description:
      "A living city layer for Paris. Post a thing, share it, find your crew.",
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "Creator.Paris",
    description: "A living city layer for Paris. Post a thing, share it, find your crew.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0a0a",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-paper text-ink antialiased">
        <ClerkProvider appearance={clerkAppearance}>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}