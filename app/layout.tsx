import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata, Viewport } from "next";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <ClerkProvider appearance={clerkAppearance}>
          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}
