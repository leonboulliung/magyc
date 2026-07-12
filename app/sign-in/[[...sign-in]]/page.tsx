import { Suspense } from "react";
import { AuthShell } from "@/components/auth/AuthShell";
import { AuthWidget } from "@/components/auth/AuthWidget";
import { getServerI18n } from "@/lib/i18n/server";

/**
 * Native sign-in page. `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in` points Clerk
 * here, so this route must exist (without it, every sign-in redirect 404s).
 * Public — the middleware only protects /studio. Wrapped in AuthShell so the
 * screen reads as branded infrastructure, not a third-party form.
 */
export async function generateMetadata() {
  const { t } = await getServerI18n();
  return { title: `${t.auth.signIn} — MAGYC`, robots: { index: false } };
}

export default function SignInPage() {
  return (
    <AuthShell mode="signin">
      <Suspense fallback={<div className="h-[420px] w-full rounded-xl border border-black/10 bg-white" />}>
        <AuthWidget mode="signin" />
      </Suspense>
    </AuthShell>
  );
}
