"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { Space } from "@/lib/types";

/**
 * Privacy footer toggle — Public / Password.
 *
 * UI scaffolding for the visibility toggle. Wires the backend in a
 * follow-up: today this surface lets us SEE the affordance and copy
 * the password placeholder so we can position it in the footer.
 *
 * When visibility === 'password', the password row reveals with a copy
 * button. The actual password generation + hashing belongs in a
 * dedicated endpoint we'll wire after the layout shape sits.
 */
export function SpacePrivacy({ space }: { space: Space }) {
  const [mode, setMode] = useState<"public" | "password">(
    space.visibility === "password" ? "password" : "public",
  );
  const [copied, setCopied] = useState(false);

  // Placeholder password until the backend wiring lands — generated
  // once per page-load so the UI feels real for testing.
  const [password] = useState(() =>
    typeof window !== "undefined"
      ? `pw-${Math.random().toString(36).slice(2, 10)}`
      : "pw-loading",
  );

  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      window.prompt("Password", password);
    }
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Two-way pill toggle */}
      <div
        className="flex items-center rounded-full p-0.5"
        style={{ background: "var(--v-rule)" }}
      >
        <button
          onClick={() => setMode("public")}
          className="mono text-[10px] tracking-widest px-3 py-1 rounded-full transition-colors"
          style={{
            background: mode === "public" ? "var(--v-fg)" : "transparent",
            color: mode === "public" ? "var(--v-bg)" : "var(--v-fg)",
          }}
        >
          public
        </button>
        <button
          onClick={() => setMode("password")}
          className="mono text-[10px] tracking-widest px-3 py-1 rounded-full transition-colors"
          style={{
            background: mode === "password" ? "var(--v-fg)" : "transparent",
            color: mode === "password" ? "var(--v-bg)" : "var(--v-fg)",
          }}
        >
          private
        </button>
      </div>

      {/* Password reveal when private — copy button */}
      <AnimatePresence>
        {mode === "password" && (
          <motion.div
            initial={{ opacity: 0, x: -4 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -4 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-2"
          >
            <code
              className="mono text-[10px] tracking-widest px-2 py-1 rounded-md"
              style={{ background: "var(--v-rule)", color: "var(--v-fg)" }}
            >
              {password}
            </code>
            <button
              onClick={copyPassword}
              className="mono text-[10px] tracking-widest underline-offset-2 hover:underline"
              style={{ color: "var(--v-fg)" }}
            >
              {copied ? "copied ✓" : "copy"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
