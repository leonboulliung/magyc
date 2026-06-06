import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
import "./globals.css";
import { UIStringsProvider } from "@/components/UIStringsProvider";
import { LocalePersister } from "@/components/LocalePersister";
import { getRequestLocale, getUIStrings } from "@/lib/ui-strings";

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
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    fontFamilyButtons: "'JetBrains Mono', ui-monospace, monospace",
    fontSize: "13px",
    borderRadius: "0px",
  },
};

export const metadata: Metadata = {
  title: "Creator",
  description: "",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getRequestLocale();
  const strings = await getUIStrings(locale);

  return (
    <html lang={locale}>
      <body className="min-h-screen antialiased">
        <ClerkProvider appearance={clerkAppearance}>
          <UIStringsProvider strings={strings} locale={locale}>
            <LocalePersister locale={locale} />
            {children}
          </UIStringsProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
