import { ClerkProvider } from "@clerk/nextjs";
import { deDE, enUS } from "@clerk/localizations";
import type { Metadata, Viewport } from "next";
import { AppToaster } from "@/components/AppToaster";
import { LocaleProvider } from "@/components/i18n/LocaleProvider";
import { getServerLocale } from "@/lib/i18n/server";
import { de } from "@/lib/i18n/dictionaries/de";
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
  description: de.messages.appDescription,
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getServerLocale();
  return (
    <html lang={locale}>
      <body className="min-h-screen bg-[#f4f4f1] text-[#17171a] antialiased">
        <ClerkProvider
          appearance={clerkAppearance}
          localization={locale === "en" ? enUS : deDE}
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/studio"
          signUpFallbackRedirectUrl="/studio"
        >
          <LocaleProvider locale={locale}>
            {children}
            <AppToaster />
          </LocaleProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
