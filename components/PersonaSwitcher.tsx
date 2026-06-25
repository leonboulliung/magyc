"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { PERSONAS, getActivePersonaId, setActivePersona } from "@/lib/personas";

/**
 * Persona switcher — a tiny floating pill in the bottom-left of any
 * space view that lets a tester swap identity between Alice and Bob
 * (and "none" = the browser's own anon token). Lets us see multi-user
 * widgets (voices, votes, claims) behave correctly without two
 * devices.
 *
 * Visible always for now. When we ship a real product the switcher
 * is gated behind a query param or env flag.
 */
export function PersonaSwitcher() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setActiveId(getActivePersonaId());
  }, []);

  if (!mounted) return null;

  const select = (id: string | null) => {
    setActivePersona(id);
    setActiveId(id);
    // Force a soft reload so anything that reads the anon token at
    // render time picks up the new identity. Cheap and reliable.
    window.location.reload();
  };

  const active = PERSONAS.find((p) => p.id === activeId);

  return (
    <div className="fixed bottom-4 left-4 z-50">
      <AnimatePresence mode="wait">
        <motion.div
          key={activeId ?? "none"}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.2 }}
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-full"
          style={{
            background: "rgba(255,255,255,0.95)",
            border: "1px solid rgba(0,0,0,0.1)",
            backdropFilter: "blur(8px)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
          }}
        >
          <span className="mono text-[9px] tracking-widest opacity-60 pl-1">AS</span>

          {/* None / real anon */}
          <button
            onClick={() => select(null)}
            className="mono text-[10px] tracking-widest px-2 py-1 rounded-full transition-colors"
            style={{
              background: activeId === null ? "#0d0d0d" : "transparent",
              color: activeId === null ? "#ffffff" : "#0d0d0d",
            }}
            title="Use the browser's real anonymous token"
          >
            self
          </button>

          {PERSONAS.map((p) => {
            const picked = activeId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => select(p.id)}
                className="mono text-[10px] tracking-widest px-2 py-1 rounded-full transition-colors flex items-center gap-1"
                style={{
                  background: picked ? "#0d0d0d" : "transparent",
                  color: picked ? "#ffffff" : "#0d0d0d",
                }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: p.swatch }}
                  aria-hidden
                />
                {p.displayName.toLowerCase()}
              </button>
            );
          })}

          {active && (
            <span
              className="mono text-[9px] tracking-widest opacity-60 pr-1.5 pl-0.5"
              style={{ borderLeft: "1px solid rgba(0,0,0,0.1)", marginLeft: "2px" }}
            >
              @{active.displayName.toLowerCase()}
            </span>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
