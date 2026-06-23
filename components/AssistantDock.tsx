"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { getSelfId, getSelfName } from "@/lib/state";
import { readApiJson } from "@/lib/client/feedback";

type Channel = "magyc" | "team";
type Message = { id?: string; role: "user" | "assistant"; content: string; authorName?: string | null; mine: boolean };

interface MsgRow {
  id: string; channel: string; role: string;
  author_id: string | null; author_name: string | null; content: string; created_at: string;
}

const STARTERS = [
  "Was fehlt noch in diesem Plan?",
  "Schlage die nächsten 5 konkreten Schritte vor.",
  "Wie könnte ich diesen Plan für meinen Kunden schärfer formulieren?",
];

function errorLabel(value: unknown): string {
  if (!value || typeof value !== "object") return "Der Assistent ist gerade nicht erreichbar.";
  const error = (value as { error?: unknown }).error;
  if (error === "rate_limited") return "Kurz warten, dann erneut versuchen.";
  if (error === "ai_not_configured") return "KI-Backend nicht konfiguriert.";
  if (typeof error === "string" && error.trim()) return error;
  return "Der Assistent ist gerade nicht erreichbar.";
}

const RING_GRADIENT = "linear-gradient(135deg, #8b7bff 0%, #4f9eff 50%, #39d2b4 100%)";

export function AssistantDock({ spaceId, onProjectChanged }: { spaceId: string; onProjectChanged?: () => void }) {
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState<Channel>("magyc");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const trimmed = draft.trim();

  const mapRow = useCallback((r: MsgRow, ch: Channel): Message => ({
    id: r.id,
    role: r.role === "assistant" ? "assistant" : "user",
    content: r.content,
    authorName: r.author_name,
    mine: ch === "magyc" ? r.role !== "assistant" : r.author_id === getSelfId(),
  }), []);

  // Load a channel's persisted history (also the source of truth on reload).
  const load = useCallback(async (ch: Channel, replaceEmpty = true) => {
    try {
      const res = await fetch(`/api/spaces/${spaceId}/messages?channel=${ch}`, { cache: "no-store" });
      const json = await readApiJson(res) as { messages?: MsgRow[] };
      const rows = Array.isArray(json.messages) ? json.messages : [];
      if (rows.length || replaceEmpty) setMessages(rows.map((r) => mapRow(r, ch)));
    } catch { /* best-effort; ephemeral fallback */ }
    finally { setLoading(false); }
  }, [spaceId, mapRow]);

  useEffect(() => {
    if (open) { setLoading(true); void load(channel); }
  }, [open, channel, load]);

  // Team chat liveness: poll while open (no realtime dependency in stage 1).
  useEffect(() => {
    if (!open || channel !== "team") return;
    const t = setInterval(() => void load("team", false), 5000);
    return () => clearInterval(t);
  }, [open, channel, load]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  function persist(ch: Channel, role: "user" | "assistant", content: string) {
    void fetch(`/api/spaces/${spaceId}/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ channel: ch, role, content, anonToken: getSelfId(), authorName: getSelfName() ?? undefined }),
    }).catch(() => {});
  }

  async function send(text = trimmed) {
    const content = text.trim();
    if (!content || busy) return;
    setOpen(true);
    setDraft("");
    setError(null);

    if (channel === "team") {
      setMessages((cur) => [...cur, { role: "user", content, authorName: getSelfName(), mine: true }]);
      persist("team", "user", content);
      setTimeout(() => inputRef.current?.focus(), 30);
      return;
    }

    // MAGYC channel: streamed reply (may act via tools), both ends persisted.
    const history = messages.slice(-8).map((m) => ({ role: m.role, content: m.content }));
    setMessages((cur) => [...cur, { role: "user", content, mine: true }]);
    persist("magyc", "user", content);
    setBusy(true);
    try {
      const res = await fetch(`/api/spaces/${spaceId}/assistant`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: content, anonToken: getSelfId(), history }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(errorLabel(json));
      }
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      let added = false;
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        if (!added) {
          added = true;
          setBusy(false); // first token arrived — drop the "denkt nach" hint
          setMessages((cur) => [...cur, { role: "assistant", content: acc, authorName: "@magyc", mine: false }]);
        } else {
          setMessages((cur) => { const c = [...cur]; c[c.length - 1] = { ...c[c.length - 1], content: acc }; return c; });
        }
      }
      if (acc.trim()) persist("magyc", "assistant", acc);
      onProjectChanged?.(); // a tool may have changed the page — refresh it
      setTimeout(() => inputRef.current?.focus(), 30);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nicht erreichbar.");
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) { e.preventDefault(); void send(); }
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); void send(); }
  }
  function switchChannel(ch: Channel) {
    if (ch === channel) return;
    setChannel(ch);
    setMessages([]);
    setLoading(true); // suppress the empty-state flash until the channel loads
    setError(null);
  }

  const isMagyc = channel === "magyc";

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3 sm:bottom-5 sm:right-5">
      {open && (
        <section
          className="flex w-[calc(100vw-2rem)] max-w-[420px] flex-col overflow-hidden rounded-2xl shadow-2xl"
          style={{ background: "#0f1012", border: "1px solid rgba(255,255,255,0.10)" }}
        >
          {/* Header with channel switch */}
          <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-4 py-3">
            <div className="inline-flex rounded-full border border-white/12 bg-white/[0.03] p-0.5 text-[11px]">
              <button type="button" onClick={() => switchChannel("magyc")} className={`rounded-full px-3 py-1 transition-colors ${isMagyc ? "bg-white text-black" : "text-white/55 hover:text-white"}`}>@magyc</button>
              <button type="button" onClick={() => switchChannel("team")} className={`rounded-full px-3 py-1 transition-colors ${!isMagyc ? "bg-white text-black" : "text-white/55 hover:text-white"}`}>Team</button>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Schließen"
              className="flex h-7 w-7 items-center justify-center rounded-full border border-white/12 text-[14px] text-white/50 transition-colors hover:border-white/25 hover:text-white"
            >
              ×
            </button>
          </header>

          {/* Messages */}
          <div className="flex max-h-[46vh] min-h-[80px] flex-col gap-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && !busy && !loading && isMagyc && (
              <div className="space-y-3">
                <div className="mr-4">
                  <div className="whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-[13px] leading-relaxed text-white/85">
                    Ich bin <span className="text-white">@magyc</span> und begleite dieses Projekt durchgehend — frag mich jederzeit, wenn du etwas am Plan ändern, ergänzen oder schärfer formulieren willst.
                  </div>
                </div>
                {STARTERS.map((s) => (
                  <button key={s} type="button" onClick={() => void send(s)} className="block w-full rounded-xl border border-white/10 bg-white/[0.02] px-3 py-2.5 text-left text-[13px] leading-snug text-white/65 transition-colors hover:border-white/20 hover:text-white">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {messages.length === 0 && !busy && !loading && !isMagyc && (
              <p className="px-1 text-[13px] leading-relaxed text-white/40">
                Schreib hier mit allen, die an diesem Projekt mitwirken. Nachrichten bleiben am Projekt.
              </p>
            )}

            {messages.map((m, i) => (
              <div key={m.id ?? i} className={m.mine ? "ml-8 flex justify-end" : "mr-4"}>
                {m.mine ? (
                  <div className="max-w-full whitespace-pre-wrap rounded-2xl rounded-br-sm bg-white px-3.5 py-2.5 text-[13px] leading-relaxed text-black">
                    {m.content}
                  </div>
                ) : (
                  <div className="max-w-full">
                    {!isMagyc && <div className="mb-0.5 ml-1 text-[10px] text-white/35">{m.authorName || "Mitwirkende:r"}</div>}
                    <div className="whitespace-pre-wrap rounded-2xl rounded-bl-sm border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-[13px] leading-relaxed text-white/85">
                      {m.content}
                    </div>
                  </div>
                )}
              </div>
            ))}

            {busy && (
              <div className="mr-4">
                <div className="inline-flex items-center gap-1.5 rounded-2xl rounded-bl-sm border border-white/10 bg-white/[0.04] px-3.5 py-2.5">
                  <span className="mono animate-pulse text-[11px] tracking-widest text-white/40">denkt nach …</span>
                </div>
              </div>
            )}
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2.5 text-[12px] text-red-300/80">{error}</div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={onSubmit} className="shrink-0 border-t border-white/10 p-3">
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
                rows={1}
                maxLength={2000}
                placeholder={isMagyc ? "Frag @magyc … (Enter sendet)" : "Nachricht ans Team … (Enter sendet)"}
                className="min-h-[40px] flex-1 resize-none rounded-xl border border-white/12 bg-white/[0.03] px-3 py-2.5 text-[13px] leading-snug text-white outline-none placeholder:text-white/30 focus:border-white/30"
                style={{ maxHeight: "120px" }}
              />
              <button type="submit" disabled={busy || !trimmed} aria-label="Senden" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl disabled:opacity-30" style={{ background: RING_GRADIENT }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 8h12M10 4l4 4-4 4" stroke="#000" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Trigger */}
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setTimeout(() => inputRef.current?.focus(), 40); }}
        className="mono flex h-9 items-center gap-2 rounded-full px-4 text-[11px] uppercase tracking-widest text-black shadow-lg transition-opacity hover:opacity-90"
        style={{ background: RING_GRADIENT }}
      >
        @magyc
      </button>
    </div>
  );
}
