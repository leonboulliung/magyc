import Link from "next/link";
import { SignIn } from "@clerk/nextjs";

/**
 * Native sign-in page. `NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in` points Clerk
 * here, so this route must exist (without it, every sign-in redirect 404s).
 * Public — the middleware only protects /studio. App-branded so Clerk reads as
 * infrastructure, not a third-party screen.
 */
export const metadata = { title: "Anmelden — MAGYC", robots: { index: false } };

export default function SignInPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12" style={{ background: "#f4f4f1" }}>
      <Link href="/" aria-label="MAGYC" className="flex items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/magyc-logo.png" alt="MAGYC" className="h-[22px] w-auto" />
      </Link>
      <SignIn />
    </main>
  );
}
