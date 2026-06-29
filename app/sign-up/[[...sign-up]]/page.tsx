import Link from "next/link";
import { SignUp } from "@clerk/nextjs";

/**
 * Native sign-up page. `NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up` points Clerk
 * here, so this route must exist (without it, every sign-up redirect 404s).
 * Public — the middleware only protects /studio.
 */
export const metadata = { title: "Registrieren — MAGYC", robots: { index: false } };

export default function SignUpPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-4 py-12" style={{ background: "#f4f4f1" }}>
      <Link href="/" aria-label="MAGYC" className="flex items-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/magyc-logo.png" alt="MAGYC" className="h-[22px] w-auto" />
      </Link>
      <SignUp />
    </main>
  );
}
