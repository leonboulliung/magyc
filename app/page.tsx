"use client";

import { SignInButton, SignedIn, SignedOut, UserButton, useUser } from "@clerk/nextjs";

/**
 * Blank slate. The infrastructure (Clerk auth, Supabase client, Vercel
 * pipeline) is live; the application is undecided. Next conversation
 * picks the concept and the build resumes from here.
 */
export default function HomePage() {
  const { user, isLoaded } = useUser();
  return (
    <main className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-rule">
        <span className="font-black tracking-tightest text-[16px]">CREATOR</span>
        <div className="flex items-center gap-3">
          <SignedIn>
            <span className="mono text-[11px] opacity-70">
              {isLoaded && user ? `@${user.username ?? user.id.slice(-6)}` : ""}
            </span>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="mono text-[11px] tracking-widest px-3 py-1.5 rounded-full border border-rule-strong hover:bg-ink hover:text-paper transition-colors">
                SIGN IN
              </button>
            </SignInButton>
          </SignedOut>
        </div>
      </header>

      <section className="flex-1 grid place-items-center px-6 py-20">
        <div className="max-w-xl text-center space-y-4">
          <div className="mono text-[10px] tracking-widest opacity-60">CLEAN SLATE</div>
          <h1 className="editorial font-black text-[40px] sm:text-[56px] leading-[0.95]">
            Nothing here yet.
          </h1>
          <p className="mono text-[12px] opacity-70 leading-relaxed">
            The infrastructure is live — Auth, DB, deploy. The app itself
            is the next decision.
          </p>
        </div>
      </section>
    </main>
  );
}
