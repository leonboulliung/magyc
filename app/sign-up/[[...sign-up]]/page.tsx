import { SignUp } from "@clerk/nextjs";
import { AuthShell } from "@/components/auth/AuthShell";

/**
 * Native sign-up page. `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up` points Clerk
 * here, so this route must exist (without it, every sign-up redirect 404s).
 * Public — the middleware only protects /studio. Wrapped in AuthShell so cold
 * ad-email traffic sees the product promise beside the form.
 */
export const metadata = { title: "Registrieren — MAGYC", robots: { index: false } };

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

export default function SignUpPage() {
  return (
    <AuthShell mode="signup">
      <SignUp appearance={appearance} />
    </AuthShell>
  );
}
