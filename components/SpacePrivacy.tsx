"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { label } from "@/lib/labels";
import type { Space } from "@/lib/types";

/**
 * Privacy footer toggle — Public / Private.
 *
 * Every visible word reads from space.labels with Unicode-symbol
 * fallbacks. The component imposes no language.
 */
export function SpacePrivacy({ space }: { space: Space }) {
  const [mode, setMode] = useState<"public" | "password">(
    space.visibility === "password" ? "password" : "public",
  );
  const [copied, setCopied] = useState(false);
  const L = space.labels;

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
      window.prompt("password", password);
    }
  };

  return (
    <div className="flex items-center gap-3 flex-wrap">
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
          {label(L, "visibilityPublic")}
        </button>
        <button
          onClick={() => setMode("password")}
          className="mono text-[10px] tracking-widest px-3 py-1 rounded-full transition-colors"
          style={{
            background: mode === "password" ? "var(--v-fg)" : "transparent",
            color: mode === "password" ? "var(--v-bg)" : "var(--v-fg)",
          }}
        >
          {label(L, "visibilityPrivate")}
        </button>
      </div>

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
              className="mono text-[10px] tracking-widest px-2 py-1 rounded-[var(--v-radius)]"
              style={{ background: "var(--v-rule)", color: "var(--v-fg)" }}
            >
              {password}
            </code>
            <button
              onClick={copyPassword}
              className="mono text-[10px] tracking-widest underline-offset-2 hover:underline"
              style={{ color: "var(--v-fg)" }}
            >
              {copied ? `${label(L, "copied")} ✓` : label(L, "copy")}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
