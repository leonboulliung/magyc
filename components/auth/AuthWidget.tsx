"use client";

import { SignIn, SignUp } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";

const appearance = {
  variables: {
    colorPrimary: "#0d0d0d",
    colorText: "#17171a",
    fontFamily: "Manrope, ui-sans-serif, system-ui, sans-serif",
    borderRadius: "12px",
  },
  elements: {
    rootBox: "w-full",
    card: "shadow-none border border-black/10 bg-white",
    headerTitle: "font-brand",
  },
} as const;

function safeRedirect(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/studio";
  return raw;
}

export function AuthWidget({ mode }: { mode: "signin" | "signup" }) {
  const params = useSearchParams();
  const redirectUrl = safeRedirect(params.get("redirect_url") ?? params.get("redirectUrl"));

  if (mode === "signup") {
    return (
      <SignUp
        appearance={appearance}
        fallbackRedirectUrl={redirectUrl}
        signInFallbackRedirectUrl={redirectUrl}
      />
    );
  }

  return (
    <SignIn
      appearance={appearance}
      fallbackRedirectUrl={redirectUrl}
      signUpFallbackRedirectUrl={redirectUrl}
    />
  );
}
