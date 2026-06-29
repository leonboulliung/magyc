/**
 * AiTraceTimeline — a strictly read-only provenance view for one project.
 *
 * Renders the `ai_events` already recorded across the lifecycle (project
 * creation → clarifications → contract draft → @magyc turns), so an admin can
 * trace WHAT the AI did and ON WHICH INPUT — without any interactive widgets
 * (the old "ghost" inspector let an admin mutate content + join as a member).
 * Server component; expand/collapse via native <details>, no client JS.
 */

export interface AiTraceEvent {
  id: string;
  event_type: string;
  model: string | null;
  status: string | null;
  input: string | null;
  output: string | null;
  metadata: Record<string, unknown> | null;
  latency_ms: number | null;
  tokens_in: number | null;
  tokens_out: number | null;
  created_at: string;
  user_id: string | null;
  anon_id: string | null;
}

const LABELS: Record<string, string> = {
  classify: "Projekt erstellt — Element-Auswahl",
  clarify: "Rückfragen generiert",
  contract_draft: "Vertragsentwurf erzeugt",
  assistant_chat: "@magyc-Chat",
  regenerate: "Element neu generiert",
};

function label(type: string): string {
  return LABELS[type] ?? type;
}

function fmt(ts: string): string {
  try { return new Date(ts).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" }); }
  catch { return ts; }
}

/** Pretty-print a clipped JSON payload; fall back to the raw string. */
function pretty(value: string | null): string {
  if (!value) return "—";
  try { return JSON.stringify(JSON.parse(value), null, 2); }
  catch { return value; }
}

export function AiTraceTimeline({ events }: { events: AiTraceEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-black/10 bg-white p-6 text-[14px] text-black/50">
        Noch keine KI-/Daten-Ereignisse für dieses Projekt erfasst.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {events.map((e, i) => (
        <div key={e.id} className="rounded-2xl border border-black/10 bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="mono grid h-6 w-6 shrink-0 place-items-center rounded-full bg-black/[0.06] text-[11px] text-black/60">{i + 1}</span>
            <span className="text-[14px] font-medium text-[#17171a]">{label(e.event_type)}</span>
            <span
              className="mono rounded-full px-2 py-0.5 text-[10px] uppercase tracking-widest"
              style={e.status === "error"
                ? { border: "1px solid rgba(220,38,38,0.35)", color: "rgb(185,28,28)" }
                : { border: "1px solid rgba(34,197,94,0.35)", color: "rgb(21,128,61)" }}
            >
              {e.status === "error" ? "Fehler" : "ok"}
            </span>
            <span className="mono ml-auto text-[11px] text-black/40">{fmt(e.created_at)}</span>
          </div>

          <div className="mono mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-black/45">
            {e.model && <span>Modell: {e.model}</span>}
            {typeof e.latency_ms === "number" && <span>{e.latency_ms} ms</span>}
            {(e.tokens_in || e.tokens_out) && <span>Tokens: {e.tokens_in ?? 0}→{e.tokens_out ?? 0}</span>}
            <span>Akteur: {e.user_id ? `user ${e.user_id.slice(-6)}` : e.anon_id ? `anon ${e.anon_id.slice(-6)}` : "—"}</span>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Payload title="Input (Grundlage)" body={pretty(e.input)} />
            <Payload title="Output (Ergebnis)" body={pretty(e.output)} />
          </div>
        </div>
      ))}
    </div>
  );
}

function Payload({ title, body }: { title: string; body: string }) {
  const long = body.length > 240;
  return (
    <details className="group rounded-xl border border-black/10 bg-black/[0.015]" open={!long}>
      <summary className="mono cursor-pointer list-none px-3 py-2 text-[10px] uppercase tracking-widest text-black/45 marker:content-['']">
        {title}
        <span className="ml-2 normal-case text-black/30 group-open:hidden">aufklappen</span>
      </summary>
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words px-3 pb-3 text-[11px] leading-relaxed text-black/75">{body}</pre>
    </details>
  );
}
