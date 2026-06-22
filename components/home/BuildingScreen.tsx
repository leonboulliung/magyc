"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

/**
 * BuildingScreen — the "your space is coming to life" wait state shown after
 * the create flow submits. Either narrates the AI's per-space line, or cycles
 * the input's own key words so the wait feels specific. Extracted verbatim from
 * app/page.tsx (no behaviour change).
 */
export function BuildingScreen({
  inputText,
  comingToLife,
  statusText,
}: {
  inputText: string;
  comingToLife?: string;
  statusText?: string;
}) {
  // Fallback when the AI line is unavailable: cycle the input's own key
  // words so the wait still feels specific to this space.
  const words = inputText
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 12);
  const displayWords = words.length > 0 ? words : ["…"];
  const [idx, setIdx] = useState(0);
  const [showSlowHint, setShowSlowHint] = useState(false);

  const line = (comingToLife || "").trim();

  useEffect(() => {
    if (line || displayWords.length <= 1) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % displayWords.length), 700);
    return () => clearInterval(id);
  }, [line, displayWords.length]);

  useEffect(() => {
    setShowSlowHint(false);
    const id = window.setTimeout(() => setShowSlowHint(true), 12000);
    return () => window.clearTimeout(id);
  }, []);

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Three pulsing dots */}
      <div className="flex items-center gap-2">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="inline-block rounded-full bg-black"
            style={{ width: 5, height: 5 }}
            animate={{ opacity: [0.15, 1, 0.15], scale: [0.7, 1.15, 0.7] }}
            transition={{ duration: 1.4, repeat: Infinity, delay: i * 0.22, ease: "easeInOut" }}
          />
        ))}
      </div>

      {line ? (
        // The AI's "bringing your idea to life" line — specific to this
        // space, in the user's language. Reads as the build narrating
        // itself rather than a generic spinner.
        <motion.p
          className="text-[17px] sm:text-[19px] leading-relaxed text-center max-w-md px-6"
          style={{ color: "rgba(0,0,0,0.78)" }}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          {line}
        </motion.p>
      ) : (
        <div style={{ height: 28 }} className="flex items-center">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={idx}
              className="mono text-[12px] tracking-widest text-center"
              style={{ color: "rgba(0,0,0,0.28)" }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0, transition: { duration: 0.3, ease: "easeOut" } }}
              exit={{ opacity: 0, y: -6, transition: { duration: 0.2, ease: "easeIn" } }}
            >
              {displayWords[idx]}
            </motion.span>
          </AnimatePresence>
        </div>
      )}

      {statusText && (
        <p className="mono text-[10px] tracking-widest opacity-45 text-center">
          {statusText}
        </p>
      )}

      {showSlowHint && (
        <p className="text-[13px] opacity-45 text-center px-6 leading-relaxed">
          Still working. Your space can take a little longer when the prompt is complex.
        </p>
      )}
    </div>
  );
}
