"use client";

import { FormEvent, useMemo, useRef, useState } from "react";
import { getSelfId } from "@/lib/state";
import { readApiJson, showActionError } from "@/lib/client/feedback";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const STARTERS = [
  "Find missing information in this project.",
  "Suggest the next 5 concrete steps.",
  "Make this plan sharper for collaborators.",
];

function errorLabel(value: unknown) {
  if (!value || typeof value !== "object") return "The assistant is unavailable.";
  const error = (value as { error?: unknown }).error;
  if (error === "rate_limited") return "Please wait a moment before asking again.";
  if (error === "ai_not_configured") return "The AI backend is not configured yet.";
  if (typeof error === "string" && error.trim()) return error;
  return "The assistant is unavailable.";
}

export function AssistantDock({ spaceId }: { spaceId: string }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const trimmed = draft.trim();
  const history = useMemo(() => messages.slice(-8), [messages]);

  async function send(text = trimmed) {
    const question = text.trim();
    if (!question || busy) return;
    setOpen(true);
    setDraft("");
    setError(null);
    const nextMessages: Message[] = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);
    setBusy(true);
    try {
      const res = await fetch(`/api/spaces/${spaceId}/assistant`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          question,
          anonToken: getSelfId(),
          history,
        }),
      });
      const json = await readApiJson(res);
      if (!res.ok || !json?.answer) throw new Error(errorLabel(json));
      setMessages((current) => [...current, { role: "assistant", content: String(json.answer) }]);
      window.setTimeout(() => inputRef.current?.focus(), 30);
    } catch (err) {
      const message = err instanceof Error ? err.message : "The assistant is unavailable.";
      setError(message);
      showActionError("Assistant nicht erreichbar", { description: message });
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void send();
  }

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3 sm:bottom-5 sm:right-5">
      {open && (
        <section
          className="w-[calc(100vw-2rem)] max-w-[420px] overflow-hidden rounded-[var(--v-radius)] border shadow-[0_18px_60px_rgba(0,0,0,0.14)]"
          style={{
            background: "color-mix(in srgb, var(--v-bg) 94%, white)",
            borderColor: "var(--v-rule)",
            color: "var(--v-fg)",
          }}
        >
          <header
            className="flex items-center justify-between gap-3 border-b px-4 py-3"
            style={{ borderColor: "var(--v-rule)" }}
          >
            <div>
              <div className="mono text-[10px] uppercase tracking-widest opacity-50">MAGYC assistant</div>
              <div className="text-sm opacity-75">Ask about this project.</div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="grid h-8 w-8 place-items-center rounded-[var(--v-radius)] border text-sm"
              style={{ borderColor: "var(--v-rule)" }}
              aria-label="Close assistant"
              title="Close assistant"
            >
              x
            </button>
          </header>

          <div className="max-h-[46vh] space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="space-y-2">
                {STARTERS.map((starter) => (
                  <button
                    key={starter}
                    type="button"
                    onClick={() => void send(starter)}
                    className="block w-full rounded-[var(--v-radius)] border px-3 py-2 text-left text-sm transition hover:opacity-75"
                    style={{ borderColor: "var(--v-rule)", background: "var(--v-card)" }}
                  >
                    {starter}
                  </button>
                ))}
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={`${message.role}-${index}`}
                className={message.role === "user" ? "ml-8 text-right" : "mr-8 text-left"}
              >
                <div
                  className="inline-block max-w-full whitespace-pre-wrap rounded-[var(--v-radius)] border px-3 py-2 text-sm leading-relaxed"
                  style={{
                    borderColor: "var(--v-rule)",
                    background: message.role === "user" ? "var(--v-fg)" : "var(--v-card)",
                    color: message.role === "user" ? "var(--v-bg)" : "var(--v-fg)",
                  }}
                >
                  {message.content}
                </div>
              </div>
            ))}

            {busy && <div className="mono text-[10px] uppercase tracking-widest opacity-45">thinking...</div>}
            {error && <div className="text-sm text-red-700">{error}</div>}
          </div>

          <form onSubmit={onSubmit} className="border-t p-3" style={{ borderColor: "var(--v-rule)" }}>
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                rows={2}
                maxLength={1200}
                placeholder="Ask MAGYC..."
                className="min-h-11 flex-1 resize-none rounded-[var(--v-radius)] border bg-transparent px-3 py-2 text-sm leading-relaxed outline-none"
                style={{ borderColor: "var(--v-rule)" }}
              />
              <button
                type="submit"
                disabled={busy || !trimmed}
                className="h-11 rounded-[var(--v-radius)] border px-4 mono text-[10px] uppercase tracking-widest disabled:opacity-35"
                style={{ borderColor: "var(--v-rule)", background: "var(--v-fg)", color: "var(--v-bg)" }}
              >
                send
              </button>
            </div>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          window.setTimeout(() => inputRef.current?.focus(), 40);
        }}
        className="h-12 rounded-[var(--v-radius)] border px-4 shadow-[0_10px_30px_rgba(0,0,0,0.12)] mono text-[10px] uppercase tracking-widest"
        style={{
          borderColor: "var(--v-rule)",
          background: "var(--v-fg)",
          color: "var(--v-bg)",
        }}
      >
        Ask MAGYC
      </button>
    </div>
  );
}
