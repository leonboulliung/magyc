import { SignIn } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth/AuthShell";

/**
 * Native sign-in page. `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in` points Clerk
 * here, so this route must exist (without it, every sign-in redirect 404s).
 * Public — the middleware only protects /studio. Wrapped in AuthShell so the
 * screen reads as branded infrastructure, not a third-party form.
 */
export const metadata = { title: "Anmelden — MAGYC", robots: { index: false } };

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

export default function SignInPage() {
  return (
    <AuthShell mode="signin">
      <SignIn appearance={appearance} />
    </AuthShell>
  );
}
