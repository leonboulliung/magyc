import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthWidget } from "@/components/auth/AuthWidget";

/**
 * Native sign-up page. `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up` points Clerk
 * here, so this route must exist (without it, every sign-up redirect 404s).
 * Public — the middleware only protects /studio. Wrapped in AuthShell so cold
 * ad-email traffic sees the product promise beside the form.
 */
export const metadata = { title: "Registrieren — MAGYC", robots: { index: false } };

export default function SignUpPage() {
  return (
    <AuthShell mode="signup">
      <Suspense fallback={<div className="h-[420px] w-full rounded-xl border border-black/10 bg-white" />}>
        <AuthWidget mode="signup" />
      </Suspense>
    </AuthShell>
  );
}
