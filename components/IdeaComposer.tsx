"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { combinedSearch, type LocationResult } from "@/lib/location";
import { TagInput } from "./TagInput";

const TAG_SUGGESTIONS = [
  "film", "music", "art", "fashion", "food", "walks",
  "photography", "design", "build", "talk", "book", "space",
];

/**
 * The fast path: throw an IDEA into the field. The protocol rule — a thought
 * becomes real by being shared — wants almost zero friction here. The ONLY
 * required field is the idea itself. Location and tags are optional flavor.
 *
 * Seeded optionally from the AI draft (title/description/tags/location).
 */
export function IdeaComposer({
  onClose,
  onBack,
  onRequestAIDraft,
  initial,
}: {
  onClose: () => void;
  onBack?: () => void;
  /** Opt-in AI helper: hand off to the prompt step to pre-fill from a sentence. */
  onRequestAIDraft?: () => void;
  initial?: {
    title?: string;
    description?: string | null;
    tags?: string[];
    locationQuery?: string | null;
    location?: { lat: number; lng: number; label: string } | null;
  } | null;
}) {
  const router = useRouter();

  // The idea text is the headline. We keep it as a single first-class field.
  const [text, setText] = useState(initial?.title || "");
  const [tags, setTags] = useState<string[]>(initial?.tags || []);
  const [showMore, setShowMore] = useState(
    !!(initial?.description || initial?.tags?.length || initial?.locationQuery),
  );
  const [note, setNote] = useState(initial?.description || "");

  // Optional loose location (not required for an idea).
  const [query, setQuery] = useState(
    initial?.location?.label || initial?.locationQuery || "",
  );
  const [latlng, setLatlng] = useState<{ lat: number; lng: number } | null>(
    initial?.location ? { lat: initial.location.lat, lng: initial.location.lng } : null,
  );
  const [picked, setPicked] = useState<LocationResult | null>(null);
  const [suggestions, setSuggestions] = useState<LocationResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // If the AI gave a locationQuery but no lat/lng, resolve it once.
  useEffect(() => {
    if (!initial?.locationQuery || initial?.location) return;
    let cancelled = false;
    (async () => {
      const ctrl = new AbortController();
      const results = await combinedSearch(initial.locationQuery!, ctrl.signal);
      if (cancelled || !results[0]) return;
      const r = results[0];
      setPicked(r);
      setQuery(r.label);
      setLatlng({ lat: r.lat, lng: r.lng });
    })().catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!query || query === picked?.label) {
      setSuggestions([]);
      return;
    }
    const handle = window.setTimeout(async () => {
      setSearching(true);
      const ctrl = new AbortController();
      try {
        setSuggestions(await combinedSearch(query, ctrl.signal));
      } finally {
        setSearching(false);
      }
    }, 220);
    return () => window.clearTimeout(handle);
  }, [query, picked]);

  const canSubmit = text.trim().length >= 4 && !submitting;

  async function submit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          kind: "idea",
          title: text.trim(),
          description: note.trim(),
          tags,
          location: latlng
            ? { lat: latlng.lat, lng: latlng.lng, label: picked?.label || query.trim() || "Paris" }
            : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || "Failed to share");
        return;
      }
      onClose();
      router.push(`/post/${json.id}?new=idea`);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="h-full w-full flex flex-col bg-paper cp-idea-frame">
      <div className="flex items-center justify-between border-b border-rule-strong px-4 sm:px-6 py-3 sm:py-4 shrink-0 safe-top">
        <div className="mono text-[10px] tracking-widest opacity-70 flex items-center gap-2">
          <span className="cp-idea-mark" /> NEW IDEA
        </div>
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="mono text-[11px] tracking-widest hover:underline">
              ← BACK
            </button>
          )}
          <button onClick={onClose} className="mono text-[11px] tracking-widest hover:underline">
            CLOSE ✕
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[720px] w-full mx-auto px-4 sm:px-8 py-8 sm:py-12 flex flex-col gap-6">
          <div>
            <div className="mono text-[10px] tracking-widest opacity-60">
              A THOUGHT BECOMES REAL BY BEING SHARED
            </div>
            <h1 className="editorial font-black text-[30px] sm:text-[46px] leading-[0.95] mt-2">
              Wouldn&rsquo;t it be great if&hellip;
            </h1>
            <p className="mono text-[12px] opacity-70 mt-3 leading-relaxed">
              One line is enough. No time, no place, no plan needed yet. Throw it
              in — others will resonate, and when enough do, you make it real.
            </p>
            {onRequestAIDraft && (
              <button
                type="button"
                onClick={onRequestAIDraft}
                className="mono text-[10px] tracking-widest opacity-70 hover:opacity-100 underline underline-offset-2 mt-3 inline-block"
              >
                ✦ Or draft from a sentence
              </button>
            )}
          </div>

          <div className="relative">
            <textarea
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
              }}
              placeholder="…we turned the empty print shop on rue Volta into a zine library."
              rows={3}
              maxLength={200}
              className="w-full border border-rule-strong bg-white px-4 py-3 editorial text-[20px] sm:text-[24px] leading-[1.25] focus:outline-none focus:ring-2 focus:ring-ink resize-none"
            />
            <div className="absolute bottom-2 right-3 mono text-[10px] opacity-50 tabular-nums">
              {text.length}/200
            </div>
          </div>

          {!showMore ? (
            <button
              onClick={() => setShowMore(true)}
              className="mono text-[11px] tracking-widest opacity-60 hover:opacity-100 hover:underline self-start"
            >
              + ADD A NOTE, TAGS, OR A LOOSE PLACE (OPTIONAL)
            </button>
          ) : (
            <div className="space-y-5 animate-fadeIn">
              <div>
                <label className="mono text-[10px] tracking-widest opacity-70">
                  NOTE <span className="opacity-50">(OPTIONAL)</span>
                </label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  maxLength={500}
                  placeholder="A sentence more, if it helps people picture it."
                  className="input mt-1 resize-none"
                />
              </div>

              <div>
                <label className="mono text-[10px] tracking-widest opacity-70">
                  TAGS <span className="opacity-50">(OPTIONAL)</span>
                </label>
                <TagInput
                  value={tags}
                  onChange={setTags}
                  max={5}
                  suggestions={TAG_SUGGESTIONS}
                  placeholder="e.g. zine, neighborhood"
                  className="mt-1"
                />
              </div>

              <div>
                <label className="mono text-[10px] tracking-widest opacity-70">
                  LOOSE PLACE <span className="opacity-50">(OPTIONAL)</span>
                  {searching && <span className="ml-2 opacity-60">SEARCHING…</span>}
                </label>
                <div className="relative">
                  <input
                    value={query}
                    onChange={(e) => { setQuery(e.target.value); setPicked(null); }}
                    placeholder="A quartier or street — only if it has one in mind."
                    className="input mt-1"
                  />
                  {suggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-full bg-paper border border-rule-strong border-t-0 z-20 max-h-60 overflow-y-auto">
                      {suggestions.map((s, i) => (
                        <button
                          key={`${s.label}-${s.lat}-${s.lng}-${i}`}
                          type="button"
                          onClick={() => {
                            setPicked(s); setQuery(s.label);
                            setLatlng({ lat: s.lat, lng: s.lng }); setSuggestions([]);
                          }}
                          className="block w-full text-left px-3 py-2 hover:bg-ink hover:text-paper border-b border-rule last:border-b-0"
                        >
                          <div className="font-medium text-[13px] leading-tight">{s.label}</div>
                          <div className="mono text-[9px] tracking-widest opacity-60 mt-0.5">
                            {s.source === "quartier" ? "◆ " : "● "}{s.hint || "PARIS"}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {latlng && (
                  <div className="mono text-[10px] mt-2 opacity-70">
                    ◦ {latlng.lat.toFixed(4)}, {latlng.lng.toFixed(4)} — a loose pin, easy to move later
                  </div>
                )}
              </div>
            </div>
          )}

          {error && (
            <div className="mono text-[11px] text-red-700 border-l-2 border-red-700 pl-2">
              {error.toUpperCase()}
            </div>
          )}
        </div>
      </div>

      <div
        className="border-t border-rule-strong px-4 sm:px-8 py-3 shrink-0 flex items-center justify-between gap-3"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" }}
      >
        <span className="mono text-[10px] opacity-50 hidden sm:inline">⌘ + ENTER to throw it in</span>
        <div className="flex items-center gap-2 ml-auto">
          <button onClick={onClose} className="btn ghost" disabled={submitting}>Cancel</button>
          <button onClick={submit} disabled={!canSubmit} className={`btn ${!canSubmit ? "opacity-40" : ""}`}>
            {submitting ? "Throwing…" : "Throw it in →"}
          </button>
        </div>
      </div>
    </div>
  );
}
