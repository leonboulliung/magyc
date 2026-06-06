"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { fetchSpaceById } from "@/lib/db";
import type { Space } from "@/lib/types";
import { ModuleRenderer } from "@/components/modules";

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

  return (
    <div className={`vibe-root vibe-${space.vibe} min-h-screen`}>
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-5">
        {space.modules.map((m, i) => (
          <ModuleRenderer
            key={i}
            spaceId={space.id}
            module={m}
            moduleIndex={i}
            state={space.state}
            onChanged={refresh}
          />
        ))}

        <footer className="pt-10 flex items-center justify-between">
          <Link href="/" className="mono text-[10px] tracking-widest opacity-50 hover:opacity-100">
            ← new
          </Link>
          <span className="mono text-[9px] tracking-widest opacity-30">CREATOR</span>
        </footer>
      </main>
    </div>
  );
}
