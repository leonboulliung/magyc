"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SignedIn, SignedOut, SignUpButton } from "@clerk/nextjs";
import { Header } from "@/components/Header";
import { ParisMap } from "@/components/ParisMap";
import { FeedPanel } from "@/components/FeedPanel";
import { CardCreate } from "@/components/CardCreate";
import { fetchActiveCards } from "@/lib/db";
import { useRealtimeCards } from "@/lib/realtime";
import type { Card } from "@/lib/types";
import { useIsDesktop } from "@/lib/hooks";

export default function HomePage() {
  const router = useRouter();
  const [composing, setComposing] = useState(false);
  const [cards, setCards] = useState<Card[]>([]);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const isDesktop = useIsDesktop();
  // Panel defaults: open on desktop (the feed lives in a sidebar), closed on
  // mobile (the map is primary; user taps LIST to expand the bottom-sheet).
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelInitialized, setPanelInitialized] = useState(false);

  // Set initial panel state once we know the viewport.
  useEffect(() => {
    if (panelInitialized) return;
    setPanelOpen(isDesktop);
    setPanelInitialized(true);
  }, [isDesktop, panelInitialized]);

  const refresh = useCallback(() => {
    fetchActiveCards()
      .then((next) => {
        setCards((prev) => {
          const prevIds = new Set(prev.map((c) => c.id));
          const isFirstLoad = prev.length === 0;
          const newFresh = next.filter((c) => !prevIds.has(c.id)).map((c) => c.id);
          if (!isFirstLoad && newFresh.length > 0) {
            setFreshIds((f) => {
              const nx = new Set(f);
              newFresh.forEach((id) => nx.add(id));
              return nx;
            });
            newFresh.forEach((id) => {
              window.setTimeout(() => {
                setFreshIds((f) => {
                  const nx = new Set(f);
                  nx.delete(id);
                  return nx;
                });
              }, 10_000);
            });
          }
          return next;
        });
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, []);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 60_000);
    return () => window.clearInterval(id);
  }, [refresh]);

  useRealtimeCards(refresh);

  // Hide the FAB while the mobile bottom-sheet is open — it would float over
  // the panel and visually compete with CLOSE / list scrolling.
  const fabHidden = composing || (!isDesktop && panelOpen);

  return (
    <>
      <div className="app-shell">
        <Header
          panelOpen={panelOpen}
          onTogglePanel={composing ? undefined : () => setPanelOpen((v) => !v)}
        />
        <main className="no-scroll relative">
          {composing ? (
            <CardCreate onClose={() => setComposing(false)} />
          ) : (
            <>
              <ParisMap
                cards={cards}
                freshIds={freshIds}
                onSelectCard={(id) => router.push(`/post/${id}`)}
                height="100%"
                gestureHandling={false}
              />
              {!panelOpen && (
                <button
                  onClick={() => setPanelOpen(true)}
                  className="absolute left-3 z-[500] mono text-[10px] tracking-widest bg-paper border border-ink px-2.5 py-1.5 hover:bg-ink hover:text-paper transition"
                  style={{ bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
                  aria-label="Open list"
                >
                  <span className="tabular-nums">{cards.length}</span>
                  <span className="opacity-60"> ACTIVE </span>
                  <span>· OPEN LIST →</span>
                </button>
              )}
              <FeedPanel
                open={panelOpen}
                onClose={() => setPanelOpen(false)}
                cards={cards}
                loaded={loaded}
              />
            </>
          )}
        </main>
      </div>

      {!fabHidden && (
        <>
          <SignedIn>
            <button
              onClick={() => setComposing(true)}
              className="fixed right-4 sm:right-5 z-[1000] bg-ink text-paper w-14 h-14 sm:w-auto sm:h-auto sm:px-5 sm:py-3 mono text-[12px] tracking-widest shadow-2xl hover:scale-[1.02] transition-transform duration-300 ease-out border border-paper/10"
              style={{
                bottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)",
                transform: isDesktop && panelOpen ? "translateX(-380px)" : undefined,
              }}
              aria-label="Post one thing"
            >
              <span className="sm:hidden text-2xl leading-none">+</span>
              <span className="hidden sm:inline">＋ ONE THING</span>
            </button>
          </SignedIn>

          <SignedOut>
            <SignUpButton mode="modal" forceRedirectUrl="/onboarding?next=/">
              <button
                className="fixed right-4 sm:right-5 z-[1000] bg-ink text-paper w-14 h-14 sm:w-auto sm:h-auto sm:px-5 sm:py-3 mono text-[12px] tracking-widest shadow-2xl hover:scale-[1.02] transition-transform duration-300 ease-out border border-paper/10"
                style={{
                  bottom: "calc(env(safe-area-inset-bottom, 0px) + 20px)",
                  transform: isDesktop && panelOpen ? "translateX(-380px)" : undefined,
                }}
                aria-label="Sign up to post"
              >
                <span className="sm:hidden text-2xl leading-none">+</span>
                <span className="hidden sm:inline">＋ ONE THING</span>
              </button>
            </SignUpButton>
          </SignedOut>
        </>
      )}
    </>
  );
}
