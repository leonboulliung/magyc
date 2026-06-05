"use client";

import { useEffect, useRef, useState } from "react";
import type { Card } from "@/lib/types";
import { CardItem } from "./CardItem";
import { useIsDesktop } from "@/lib/hooks";

interface Props {
  expanded: boolean;
  onExpandedChange: (v: boolean) => void;
  /** Every active card in the field. The old ideas/things split is
   *  gone — a card is a card. */
  cards: Card[];
  loaded: boolean;
  /** Card IDs that arrived in the last ~10s — get a "NEW ✦" treatment. */
  freshIds?: Set<string>;
  /** Optional handler: open the composer. No more kind tilt. */
  onCompose?: () => void;
  /** Owner IDs the current user follows — their cards lead the field. */
  followingIds?: Set<string>;
}

/**
 * THE FIELD — the living surface of the field, docked next to the map.
 *
 * One unified list. Cards from people you follow lead; the rest follow
 * in newest-first order.
 *
 * Desktop — docked right: 380px expanded / 56px vertical tab.
 * Mobile  — docked bottom: 80dvh expanded / 52px peek strip.
 */
export function FeedPanel({
  expanded,
  onExpandedChange,
  cards,
  loaded,
  freshIds,
  onCompose,
  followingIds,
}: Props) {
  const isDesktop = useIsDesktop();
  const total = cards.length;
  const collapseLabel = isDesktop ? "HIDE ›" : "MAP ↓";

  // Mobile drag-to-toggle. Same gesture machinery as before.
  const expandedGripRef = useRef<HTMLDivElement>(null);
  const collapsedStripRef = useRef<HTMLButtonElement>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const startYRef = useRef<number | null>(null);
  const lastDeltaRef = useRef(0);
  const isDraggingRef = useRef(false);

  useEffect(() => {
    if (isDesktop) return;
    const target: HTMLElement | null = expanded
      ? expandedGripRef.current
      : collapsedStripRef.current;
    if (!target) return;

    const onStart = (e: TouchEvent) => {
      startYRef.current = e.touches[0].clientY;
      lastDeltaRef.current = 0;
      isDraggingRef.current = false;
      setDragOffset(0);
    };
    const onMove = (e: TouchEvent) => {
      if (startYRef.current === null) return;
      const delta = e.touches[0].clientY - startYRef.current;
      lastDeltaRef.current = delta;
      if (Math.abs(delta) > 8) isDraggingRef.current = true;
      if (!isDraggingRef.current) return;
      e.preventDefault();
      if (expanded && delta > 0) {
        setDragOffset(delta);
      } else if (!expanded && delta < 0) {
        setDragOffset(Math.max(-40, delta * 0.4));
      }
    };
    const onEnd = () => {
      if (startYRef.current === null) return;
      const finalDelta = lastDeltaRef.current;
      const wasDrag = isDraggingRef.current;
      startYRef.current = null;
      lastDeltaRef.current = 0;
      isDraggingRef.current = false;
      setDragOffset(0);
      if (wasDrag) {
        if (expanded && finalDelta > 80) onExpandedChange(false);
        else if (!expanded && finalDelta < -50) onExpandedChange(true);
      } else if (!expanded) {
        onExpandedChange(true);
      }
    };

    target.addEventListener("touchstart", onStart, { passive: true });
    target.addEventListener("touchmove", onMove, { passive: false });
    target.addEventListener("touchend", onEnd, { passive: true });
    target.addEventListener("touchcancel", onEnd, { passive: true });

    return () => {
      target.removeEventListener("touchstart", onStart);
      target.removeEventListener("touchmove", onMove);
      target.removeEventListener("touchend", onEnd);
      target.removeEventListener("touchcancel", onEnd);
    };
  }, [isDesktop, expanded, onExpandedChange]);

  // Cards from people you follow lead the field.
  const isFollowed = (c: Card) => !!followingIds?.has(c.ownerId);
  const followed = cards.filter(isFollowed);
  const rest = cards.filter((c) => !isFollowed(c));

  const sectionLabel = (text: string) => (
    <div className="sticky top-0 z-10 bg-paper/90 backdrop-blur-md border-b border-rule px-4 py-2.5 flex items-center justify-between gap-2">
      <span className="mono text-[10px] tracking-widest font-bold">{text}</span>
      <button
        onClick={() => onExpandedChange(false)}
        className="shrink-0 mono text-[10px] tracking-widest px-2.5 py-1 rounded-full border border-rule-strong hover:bg-ink hover:text-paper transition-colors"
        aria-label="Collapse field"
      >
        {collapseLabel}
      </button>
    </div>
  );

  const emptyField = (
    <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-paper">
      <div className="sticky top-0 z-10 bg-paper/90 backdrop-blur-md border-b border-rule px-4 py-2.5 flex items-center justify-end">
        <button
          onClick={() => onExpandedChange(false)}
          className="mono text-[10px] tracking-widest px-2.5 py-1 rounded-full border border-rule-strong hover:bg-ink hover:text-paper transition-colors"
          aria-label="Collapse field"
        >
          {collapseLabel}
        </button>
      </div>
      <div className="px-4 py-12 text-center">
        <div className="editorial font-black text-[26px] leading-[0.95]">
          Nothing here yet.
        </div>
        <p className="mono text-[11px] opacity-70 mt-2 leading-relaxed">
          Write what you want to do. The app builds the rest with you.
        </p>
        {onCompose && (
          <button onClick={() => onCompose()} className="btn mt-5 mx-auto">
            ＋ POST AN IDEA
          </button>
        )}
      </div>
    </div>
  );

  const listBody = (
    <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-paper">
      {followed.length > 0 && (
        <>
          {sectionLabel("FOLLOWING")}
          {followed.map((c, i) => (
            <CardItem key={c.id} card={c} index={i} isFresh={freshIds?.has(c.id)} />
          ))}
        </>
      )}

      {rest.length > 0 && (
        <>
          {sectionLabel("THE FIELD")}
          {rest.map((c, i) => (
            <CardItem key={c.id} card={c} index={i} isFresh={freshIds?.has(c.id)} />
          ))}
        </>
      )}

      <div style={{ height: "calc(env(safe-area-inset-bottom, 0px) + 96px)" }} />
    </div>
  );

  const body = loaded && total === 0 ? emptyField : listBody;

  if (isDesktop) {
    return (
      <aside
        className={`absolute top-3 right-3 bottom-3 z-[600] flex flex-col bg-paper/95 backdrop-blur-md border border-rule rounded-2xl shadow-lg transition-[width] duration-300 ease-out overflow-hidden ${
          expanded ? "w-[380px]" : "w-[56px]"
        }`}
        aria-label="The field"
      >
        {expanded ? (
          body
        ) : (
          <button
            onClick={() => onExpandedChange(true)}
            className="w-full h-full flex flex-col items-center justify-between py-4 hover:bg-ink/[0.04] transition"
            aria-label="Open the field"
          >
            <span className="mono text-[14px] leading-none">‹</span>
            <span
              className="mono text-[10px] tracking-widest whitespace-nowrap select-none"
              style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
            >
              THE FIELD{total > 0 ? ` · ${total}` : ""}
            </span>
            <span className="mono text-[14px] leading-none">‹</span>
          </button>
        )}
      </aside>
    );
  }

  // Mobile — docked at the bottom edge.
  return (
    <>
      {expanded && (
        <div
          className="absolute inset-0 z-[590] bg-ink/10"
          onClick={() => onExpandedChange(false)}
          aria-hidden
        />
      )}
      <div
        className="absolute inset-x-0 bottom-0 z-[600] flex flex-col bg-paper/95 backdrop-blur-md border-t border-rule rounded-t-2xl shadow-lg overflow-hidden"
        style={{
          height: expanded ? "80dvh" : "52px",
          maxHeight: "calc(100dvh - 64px)",
          transform: `translateY(${dragOffset}px)`,
          transition: dragOffset > 0
            ? "none"
            : "height 300ms ease-out, transform 200ms ease-out",
        }}
        aria-label="The field"
      >
        {expanded ? (
          <>
            <div
              ref={expandedGripRef}
              className="flex flex-col justify-center items-center pt-3 pb-3 shrink-0 select-none"
              style={{
                touchAction: "none",
                WebkitUserSelect: "none",
                WebkitTouchCallout: "none",
                cursor: "grab",
              }}
              role="separator"
              aria-label="Drag to close the field"
            >
              <div className="h-1.5 w-14 bg-ink/40 rounded-full" />
            </div>
            {body}
          </>
        ) : (
          <button
            ref={collapsedStripRef}
            onClick={() => onExpandedChange(true)}
            className="w-full h-full px-4 flex items-center justify-between gap-2 relative select-none"
            style={{
              touchAction: "none",
              WebkitUserSelect: "none",
              WebkitTouchCallout: "none",
            }}
            aria-label="Pull up or tap to open the field"
          >
            <div className="absolute left-1/2 top-1.5 -translate-x-1/2 h-1.5 w-14 bg-ink/40 rounded-full" />
            <span className="mono text-[10px] tracking-widest">THE FIELD</span>
            <span className="mono text-[10px] tracking-widest">
              {total > 0 ? `${total} ↑` : "↑"}
            </span>
          </button>
        )}
      </div>
    </>
  );
}
