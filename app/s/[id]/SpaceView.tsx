"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { SignedIn, SignedOut, SignInButton, UserButton, useUser } from "@clerk/nextjs";
import { fetchSpaceById } from "@/lib/db";
import type { Space } from "@/lib/types";
import { PrimitiveBrief } from "@/components/primitives/PrimitiveBrief";
import { PrimitiveOpenQuestions } from "@/components/primitives/PrimitiveOpenQuestions";
import { PrimitiveHelpNeeded } from "@/components/primitives/PrimitiveHelpNeeded";
import { PrimitiveVoices } from "@/components/primitives/PrimitiveVoices";
import { PrimitiveResources } from "@/components/primitives/PrimitiveResources";
import { PrimitiveNextSteps } from "@/components/primitives/PrimitiveNextSteps";
import { PrimitivePlace } from "@/components/primitives/PrimitivePlace";
import { ShareButton } from "@/components/ShareButton";

export function SpaceView({ id }: { id: string }) {
  const { user } = useUser();
  const [space, setSpace] = useState<Space | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => {
    fetchSpaceById(id)
      .then((s) => { setSpace(s); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!loaded) {
    return <div className="min-h-screen bg-paper" />;
  }
  if (!space) {
    return (
      <main className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center space-y-3">
          <div className="editorial font-black text-[32px]">Nicht gefunden.</div>
          <Link href="/" className="mono text-[11px] tracking-widest hover:underline">← ZURÜCK</Link>
        </div>
      </main>
    );
  }

  const mine = !!user && user.id === space.ownerId;

  return (
    <main className="min-h-screen flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-rule">
        <Link href="/" className="font-black tracking-tightest text-[16px] hover:opacity-70">
          CREATOR
        </Link>
        <div className="flex items-center gap-3">
          <ShareButton space={space} />
          <SignedIn>
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

      <article className="flex-1 px-6 py-10 sm:py-16 max-w-3xl w-full mx-auto space-y-8">
        <div className="space-y-3">
          <div className="mono text-[10px] tracking-widest opacity-60 flex items-center gap-2 flex-wrap">
            <span>VON @{space.owner.displayName ?? space.owner.id.slice(-6)}</span>
            <span className="opacity-40">·</span>
            <span>{new Date(space.createdAt).toLocaleDateString(undefined, {
              day: "2-digit", month: "short", year: "numeric",
            }).toUpperCase()}</span>
            {mine && (
              <>
                <span className="opacity-40">·</span>
                <span>DEINE UMGEBUNG</span>
              </>
            )}
          </div>
          <h1 className="editorial font-black text-[36px] sm:text-[52px] leading-[0.95]">
            {space.title || "Eine Umgebung"}
          </h1>
          <blockquote className="border-l-2 border-rule-strong pl-4 text-[16px] leading-relaxed opacity-80 italic whitespace-pre-wrap">
            {space.inputText}
          </blockquote>
        </div>

        <div className="space-y-6">
          {space.primitives.map((p, i) => {
            const contribs = space.contributions.filter((c) => c.primitiveIndex === i);
            switch (p.type) {
              case "brief":
                return <PrimitiveBrief key={i} text={p.text} />;
              case "open_questions":
                return <PrimitiveOpenQuestions key={i} questions={p.questions} />;
              case "help_needed":
                return (
                  <PrimitiveHelpNeeded
                    key={i}
                    spaceId={space.id}
                    primitiveIndex={i}
                    asks={p.asks}
                    contributions={contribs}
                    onChanged={refresh}
                  />
                );
              case "voices":
                return (
                  <PrimitiveVoices
                    key={i}
                    spaceId={space.id}
                    primitiveIndex={i}
                    contributions={contribs}
                    onChanged={refresh}
                  />
                );
              case "resources":
                return (
                  <PrimitiveResources
                    key={i}
                    spaceId={space.id}
                    primitiveIndex={i}
                    contributions={contribs}
                    onChanged={refresh}
                  />
                );
              case "next_steps":
                return <PrimitiveNextSteps key={i} steps={p.steps} />;
              case "place":
                return <PrimitivePlace key={i} label={p.label} />;
            }
          })}
        </div>

        <div className="pt-8 border-t border-rule flex items-center justify-between flex-wrap gap-3">
          <Link href="/" className="mono text-[11px] tracking-widest hover:underline">
            ← NEUE UMGEBUNG
          </Link>
          <ShareButton space={space} variant="text" />
        </div>
      </article>
    </main>
  );
}
