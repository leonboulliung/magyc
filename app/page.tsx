"use client";

import { useState } from "react";
import { SignedIn, SignedOut, SignUpButton } from "@clerk/nextjs";
import { Header } from "@/components/Header";
import { Feed } from "@/components/Feed";
import { CardCreate } from "@/components/CardCreate";

export default function HomePage() {
  const [view, setView] = useState<"feed" | "map">("feed");
  const [composing, setComposing] = useState(false);

  return (
    <>
      <div className="min-h-screen flex flex-col">
        <Header view={view} onViewChange={setView} />
        <main className="flex-1">
          <Feed view={view} />
        </main>
      </div>

      <SignedIn>
        <button
          onClick={() => setComposing(true)}
          className="fixed right-4 sm:right-5 z-[1000] bg-ink text-paper w-14 h-14 sm:w-auto sm:h-auto sm:px-5 sm:py-3 mono text-[12px] tracking-widest shadow-2xl hover:scale-[1.02] transition border border-paper/10"
          style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)" }}
          aria-label="Post one thing"
        >
          <span className="sm:hidden text-2xl leading-none">+</span>
          <span className="hidden sm:inline">＋ ONE THING</span>
        </button>
      </SignedIn>

      <SignedOut>
        <SignUpButton mode="modal" forceRedirectUrl="/onboarding?next=/">
          <button
            className="fixed right-4 sm:right-5 z-[1000] bg-ink text-paper w-14 h-14 sm:w-auto sm:h-auto sm:px-5 sm:py-3 mono text-[12px] tracking-widest shadow-2xl hover:scale-[1.02] transition border border-paper/10"
            style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)" }}
            aria-label="Sign up to post"
          >
            <span className="sm:hidden text-2xl leading-none">+</span>
            <span className="hidden sm:inline">＋ ONE THING</span>
          </button>
        </SignUpButton>
      </SignedOut>

      {composing && <CardCreate onClose={() => setComposing(false)} />}
    </>
  );
}
