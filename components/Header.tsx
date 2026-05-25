"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { parisHour, parisNow, formatParisClock } from "@/lib/time";
import { TOD_LABEL, timeOfDayFromHour } from "@/lib/vibe";
import { Ticker } from "./Ticker";

export function Header({
  view,
  onViewChange,
}: {
  view?: "feed" | "map";
  onViewChange?: (v: "feed" | "map") => void;
}) {
  const [clock, setClock] = useState("");

  useEffect(() => {
    const tick = () => setClock(formatParisClock(parisNow()));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);

  const todLabel = TOD_LABEL[timeOfDayFromHour(parisHour())];
  const shortClock = clock ? clock.slice(0, 5) : "--:--";

  return (
    <header className="shrink-0 z-50 bg-paper border-b border-ink safe-top">
      {/* Row 1 — logo · clock · auth */}
      <div className="flex items-center px-3 sm:px-6 py-2 sm:py-3 gap-2 sm:gap-4">
        <Link href="/" className="flex items-center gap-2 group shrink-0 min-w-0">
          <span className="block w-2 h-2 sm:w-2.5 sm:h-2.5 bg-ink rounded-full group-hover:animate-pulseRing shrink-0" />
          <span className="font-black tracking-tightest text-[14px] sm:text-[17px] md:text-[19px] leading-none truncate">
            CREATOR<span className="opacity-60">.</span>PARIS
          </span>
        </Link>

        <div className="mono text-[10px] sm:text-[12px] flex items-center gap-1 sm:gap-2 ml-auto min-w-0">
          <span className="hidden md:inline opacity-60">PARIS</span>
          <span className="tabular-nums whitespace-nowrap">
            <span className="sm:hidden">{shortClock}</span>
            <span className="hidden sm:inline">{clock || "--:--:--"}</span>
          </span>
          <span className="hidden sm:inline opacity-40">·</span>
          <span className="hidden sm:inline opacity-80 truncate">{todLabel}</span>
        </div>

        {/* Desktop: view toggle + carnet + avatar all inline */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          {view && onViewChange && (
            <div className="flex border border-ink mono text-[10px] tracking-widest">
              <button
                onClick={() => onViewChange("feed")}
                className={`px-3 py-1.5 ${view === "feed" ? "bg-ink text-paper" : "bg-paper text-ink"}`}
              >
                FEED
              </button>
              <button
                onClick={() => onViewChange("map")}
                className={`px-3 py-1.5 border-l border-ink ${view === "map" ? "bg-ink text-paper" : "bg-paper text-ink"}`}
              >
                MAP
              </button>
            </div>
          )}
          <SignedIn>
            <Link
              href="/carnet"
              className="ml-1 mono text-[10px] tracking-widest px-3 py-1.5 border border-ink hover:bg-ink hover:text-paper"
            >
              PROFILE
            </Link>
            <div className="ml-1 [&_.cl-userButtonAvatarBox]:!w-9 [&_.cl-userButtonAvatarBox]:!h-9 [&_.cl-userButtonAvatarBox]:!rounded-none [&_.cl-userButtonAvatarBox]:!border [&_.cl-userButtonAvatarBox]:!border-ink">
              <UserButton afterSignOutUrl="/" />
            </div>
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="ml-1 mono text-[10px] tracking-widest px-3 py-1.5 border border-ink hover:bg-ink hover:text-paper">
                SIGN IN
              </button>
            </SignInButton>
          </SignedOut>
        </div>

        {/* Mobile: just avatar + signin */}
        <div className="flex sm:hidden items-center gap-2 shrink-0">
          <SignedIn>
            <div className="[&_.cl-userButtonAvatarBox]:!w-8 [&_.cl-userButtonAvatarBox]:!h-8 [&_.cl-userButtonAvatarBox]:!rounded-none [&_.cl-userButtonAvatarBox]:!border [&_.cl-userButtonAvatarBox]:!border-ink">
              <UserButton afterSignOutUrl="/" />
            </div>
          </SignedIn>
          <SignedOut>
            <SignInButton mode="modal">
              <button className="mono text-[10px] tracking-widest px-2.5 py-1.5 border border-ink hover:bg-ink hover:text-paper">
                SIGN IN
              </button>
            </SignInButton>
          </SignedOut>
        </div>
      </div>

      {/* Row 2 (mobile only) — view toggle + carnet, full width tabs */}
      {view && onViewChange && (
        <div className="flex sm:hidden border-t border-ink mono text-[11px] tracking-widest">
          <button
            onClick={() => onViewChange("feed")}
            className={`flex-1 py-2.5 ${view === "feed" ? "bg-ink text-paper" : "bg-paper text-ink"}`}
          >
            FEED
          </button>
          <button
            onClick={() => onViewChange("map")}
            className={`flex-1 py-2.5 border-l border-ink ${view === "map" ? "bg-ink text-paper" : "bg-paper text-ink"}`}
          >
            MAP
          </button>
          <SignedIn>
            <Link
              href="/carnet"
              className="flex-1 py-2.5 border-l border-ink text-center"
            >
              PROFILE
            </Link>
          </SignedIn>
        </div>
      )}

      <Ticker />
    </header>
  );
}
