"use client";

import { useEffect, useState } from "react";
import type { Card } from "@/lib/types";
import { CardItem } from "./CardItem";
import { formatParisClock, parisNow, parisTimeOfDay } from "@/lib/time";
import { TOD_LABEL } from "@/lib/vibe";
import { useIsDesktop } from "@/lib/hooks";

interface Props {
  open: boolean;
  onClose: () => void;
  cards: Card[];
  loaded: boolean;
}

/**
 * The feed list as an overlay panel on top of the always-on Paris map.
 * Desktop: 380px sidebar from the right.
 * Mobile: ~85vh bottom-sheet.
 *
 * Closing returns the user to the bare map.
 */
export function FeedPanel({ open, onClose, cards, loaded }: Props) {
  const [clock, setClock] = useState("--:--");
  const isDesktop = useIsDesktop();

  useEffect(() => {
    const tick = () => {
      const d = parisNow();
      setClock(formatParisClock(d).slice(0, 5));
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const tod = parisTimeOfDay();

  const headerRow = (
    <div className="shrink-0 border-b border-ink px-4 py-3 flex items-center gap-2 bg-paper">
      <span className="mono text-[10px] tracking-widest tabular-nums">{clock}</span>
      <span className="opacity-40">·</span>
      <span className="mono text-[10px] tracking-widest">{TOD_LABEL[tod]}</span>
      <span className="opacity-40">·</span>
      <span className="mono text-[10px] tracking-widest tabular-nums">
        {cards.length} ACTIVE
      </span>
      <button
        onClick={onClose}
        className="ml-auto mono text-[10px] tracking-widest px-2 py-1 border border-ink hover:bg-ink hover:text-paper transition"
        aria-label="Close list"
      >
        {isDesktop ? "HIDE ›" : "CLOSE ×"}
      </button>
    </div>
  );

  const listBody = (
    <div className="flex-1 overflow-y-auto bg-paper">
      {loaded && cards.length === 0 ? (
        <div className="px-4 py-14 border-b border-ink text-center">
          <div className="editorial font-black text-[28px] leading-[0.95]">
            The city is quiet.
          </div>
          <p className="mono text-[11px] opacity-70 mt-2">
            Be the first card. A walk, a film night, a pickup match — whatever
            you'd want company for this week.
          </p>
        </div>
      ) : (
        <>
          {cards.map((c, i) => (
            <CardItem key={c.id} card={c} index={i} />
          ))}
          {cards.length > 0 && (
            <div
              className="px-4 py-8 text-center mono text-[10px] tracking-widest opacity-50"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 96px)" }}
            >
              END OF FEED · {cards.length} CARD{cards.length > 1 ? "S" : ""}
            </div>
          )}
        </>
      )}
    </div>
  );

  if (isDesktop) {
    return (
      <aside
        className={`absolute top-0 right-0 bottom-0 w-[380px] z-[600] flex flex-col bg-paper border-l border-ink shadow-[0_0_40px_rgba(0,0,0,0.08)] transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
      >
        {headerRow}
        {listBody}
      </aside>
    );
  }

  // Mobile bottom-sheet
  return (
    <>
      {open && (
        <div
          className="absolute inset-0 z-[590] bg-ink/10"
          onClick={onClose}
          aria-hidden
        />
      )}
      <div
        className={`absolute inset-x-0 bottom-0 z-[600] flex flex-col bg-paper border-t border-ink shadow-[0_-8px_30px_rgba(0,0,0,0.18)] transition-transform duration-300 ease-out ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
        style={{ height: "85dvh" }}
        aria-hidden={!open}
      >
        <div className="flex justify-center pt-2 pb-1">
          <div className="h-1 w-10 bg-ink/30 rounded-full" />
        </div>
        {headerRow}
        {listBody}
      </div>
    </>
  );
}
