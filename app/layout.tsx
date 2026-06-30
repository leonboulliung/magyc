import { ClerkProvider } from "@clerk/nextjs";
import { deDE } from "@clerk/localizations";
import type { Metadata, Viewport } from "next";
import { AppToaster } from "@/components/AppToaster";
import "./globals.css";

const clerkAppearance = {
  variables: {
    colorPrimary: "#0d0d0d",
    colorText: "#0d0d0d",
    colorTextSecondary: "#4a4a48",
    colorBackground: "#f6f6f3",
    colorInputBackground: "#ffffff",
    colorInputText: "#0d0d0d",
    colorDanger: "#7a1f1f",
    colorSuccess: "#225f3a",
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif",
    fontFamilyButtons: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: "13px",
    borderRadius: "0px",
  },
};

export const metadata: Metadata = {
  title: "MAGYC",
  description: "Fotografie-Aufträge gemeinsam planen, abstimmen, vertraglich festhalten und professionell abschließen.",
  icons: {
    icon: [{ url: "/magyc-favicon.png", type: "image/png" }],
    apple: [{ url: "/magyc-favicon.png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="min-h-screen bg-[#f4f4f1] text-[#17171a] antialiased">
        <ClerkProvider
          appearance={clerkAppearance}
          localization={deDE}
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
        >
          {children}
          <AppToaster />
        </ClerkProvider>
      </body>
    </html>
  );
}
