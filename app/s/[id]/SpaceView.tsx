"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fetchSpaceById } from "@/lib/db";
import type { Module, Space } from "@/lib/types";
import { ModuleRenderer } from "@/components/modules";

/**
 * Space — three bands.
 *
 *   1. HERO   — headline + synthesis. Wide breathing room. No card.
 *   2. BODY   — the rest of the modules. Mixed sizes for rhythm.
 *   3. FOOTER — "neu" link + tiny brand chip.
 *
 * We pre-split the modules into hero vs body to control rendering
 * order independent of order in storage.
 */
export function SpaceView({ id }: { id: string }) {
  const [space, setSpace] = useState<Space | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => {
    fetchSpaceById(id)
      .then((s) => { setSpace(s); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [id]);

  useEffect(() => { refresh(); }, [refresh]);

  if (!loaded) return <div className="min-h-screen bg-white" />;
  if (!space) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="font-black text-[32px]">—</div>
          <Link href="/" className="mono text-[10px] tracking-widest hover:underline">back</Link>
        </div>
      </main>
    );
  }

  const heroModules: Module[] = [];
  const bodyModules: { module: Module; originalIndex: number }[] = [];
  space.modules.forEach((m, i) => {
    if (m.type === "headline" || m.type === "synthesis") {
      heroModules.push(m);
    } else {
      bodyModules.push({ module: m, originalIndex: i });
    }
  });

  return (
    <div className={`vibe-root vibe-${space.vibe} min-h-screen`}>
      <main className="max-w-3xl mx-auto px-4 sm:px-8 py-12 sm:py-20 space-y-10">
        {/* HERO — headline + synthesis. */}
        <div className="space-y-2">
          {heroModules.map((m, i) => (
            <ModuleRenderer
              key={`hero-${i}`}
              spaceId={space.id}
              module={m}
              moduleIndex={space.modules.indexOf(m)}
              state={space.state}
              onChanged={refresh}
            />
          ))}
        </div>

        {/* BODY — the rest. */}
        <div className="space-y-4">
          {bodyModules.map(({ module: m, originalIndex }) => (
            <ModuleRenderer
              key={`body-${originalIndex}`}
              spaceId={space.id}
              module={m}
              moduleIndex={originalIndex}
              state={space.state}
              onChanged={refresh}
            />
          ))}
        </div>

        <footer className="pt-8 flex items-center justify-between" style={{ borderTop: "1px solid var(--v-rule)" }}>
          <Link href="/" className="mono text-[10px] tracking-widest opacity-50 hover:opacity-100">
            ← neu
          </Link>
          <span className="mono text-[9px] tracking-widest opacity-30">CREATOR</span>
        </footer>
      </main>
    </div>
  );
}
