"use client";

import { useState } from "react";
import { useWidgetContext } from "@/lib/widgetContext";
import type { AgreementWidget, ModuleStateEntry } from "@/lib/types";
import { WidgetShell } from "./WidgetShell";
import { WidgetCard } from "./WidgetCard";
import { InlineText } from "./InlineText";
import { useInlineEdit } from "./useInlineEdit";

interface SignOff {
  id: string;
  name: string;
  actorName: string;
  at: number;
}

function fmtDateTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString("de-DE", { dateStyle: "long", timeStyle: "short" });
  } catch {
    return new Date(ts).toISOString();
  }
}

/**
 * Agreement — the binding sign-off for the Absegnung phase. Owner configures
 * parties + conditions; a collaborator confirms with name + an explicit
 * checkbox. Each confirmation is an append-only signoff record (with a terms
 * snapshot + server timestamp + actor) so the agreed version is preserved.
 */
export function AgreementRenderer({
  module: m,
  index,
  state,
}: {
  module: AgreementWidget;
  index: number;
  state: ModuleStateEntry[];
}) {
  const ctx = useWidgetContext();
  const [name, setName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);

  const signoffs: SignOff[] = state
    .filter((e) => e.kind === "add" && (e.data as { kind?: unknown }).kind === "signoff")
    .map((e) => ({
      id: e.id,
      name: typeof e.data.name === "string" && e.data.name.trim() ? (e.data.name as string) : (e.actor.displayName || "—"),
      actorName: e.actor.displayName || "",
      at: e.createdAt,
    }))
    .sort((a, b) => a.at - b.at);
  const latest = signoffs[signoffs.length - 1] || null;
  const signed = !!latest;

  const save = (patch: Partial<AgreementWidget>) => ctx.saveModule(index, { ...m, ...patch });

  const terms = useInlineEdit<HTMLTextAreaElement>({
    value: m.terms ?? "",
    onSave: (v) => save({ terms: v }),
    submitOn: "modEnter",
    trim: false,
    autoGrow: true,
  });

  async function sign() {
    const n = name.trim();
    if (!n || !agreed || busy) return;
    setBusy(true);
    const snapshot = [
      m.photographer ? `Fotograf: ${m.photographer}` : "",
      m.client ? `Kunde: ${m.client}` : "",
      m.intro || "",
      m.terms ? `\nKonditionen:\n${m.terms}` : "",
    ].filter(Boolean).join("\n").trim();
    await ctx.act(index, "add", { kind: "signoff", name: n, agreed: true, terms: snapshot });
    setAgreed(false);
    setName("");
    setBusy(false);
  }

  return (
    <WidgetShell module={m} index={index} canRegenerate={false}>
      <WidgetCard microTitle={m.microTitle} description={m.description}>
        {/* Parties */}
        <div className="grid gap-3 sm:grid-cols-2">
          <Party label="Fotograf" value={m.photographer} isOwner={ctx.isOwner} placeholder="Studio / Name" onSave={(v) => save({ photographer: v })} />
          <Party label="Kunde" value={m.client} isOwner={ctx.isOwner} placeholder="Kundenname" onSave={(v) => save({ client: v })} />
        </div>

        {/* Intro */}
        {(ctx.isOwner || m.intro) && (
          <div className="mt-4">
            <InlineText
              value={m.intro ?? ""}
              isOwner={ctx.isOwner}
              onSave={(v) => save({ intro: v })}
              placeholder="Worum geht es? (kurze Zusammenfassung)"
              className="text-[14px] leading-relaxed"
            />
          </div>
        )}

        {/* Terms / conditions */}
        <div className="mt-4">
          <div className="mono mb-1.5 text-[10px] uppercase tracking-widest" style={{ color: "var(--v-muted)" }}>
            Konditionen
          </div>
          {ctx.isOwner && terms.editing ? (
            <textarea
              {...terms.editProps}
              rows={4}
              maxLength={4000}
              placeholder="Leistungen, Umfang, Nutzungsrechte, Termine, Preis … (⌘/Strg+Enter speichert)"
              className="w-full resize-none rounded-[var(--v-radius)] bg-transparent p-3 text-[13px] leading-relaxed outline-none"
              style={{ border: "1px solid var(--v-rule)", color: "var(--v-fg)" }}
            />
          ) : (
            <button
              type="button"
              onClick={() => { if (ctx.isOwner) terms.setEditing(true); }}
              className={`block w-full whitespace-pre-wrap break-words rounded-[var(--v-radius)] p-3 text-left text-[13px] leading-relaxed ${ctx.isOwner ? "" : "cursor-default"}`}
              style={{ border: "1px solid var(--v-rule)", color: m.terms ? "var(--v-fg)" : "var(--v-muted)", background: "rgba(255,255,255,0.02)" }}
            >
              {m.terms || (ctx.isOwner ? "Konditionen festlegen …" : "Noch keine Konditionen hinterlegt.")}
            </button>
          )}
        </div>

        {/* Sign-off */}
        <div className="mt-5 border-t pt-4" style={{ borderColor: "var(--v-rule)" }}>
          {signed ? (
            <div
              className="rounded-[var(--v-radius)] p-3.5"
              style={{ border: "1px solid rgba(34,197,94,0.35)", background: "rgba(34,197,94,0.08)" }}
            >
              <div className="text-[14px] font-medium" style={{ color: "var(--v-fg)" }}>
                ✓ Verbindlich freigegeben
              </div>
              <div className="mt-1 text-[13px]" style={{ color: "var(--v-muted)" }}>
                von <span style={{ color: "var(--v-fg)" }}>{latest.name}</span> am {fmtDateTime(latest.at)}
              </div>
              {signoffs.length > 1 && (
                <div className="mono mt-2 text-[11px]" style={{ color: "var(--v-muted)" }}>
                  {signoffs.length} Freigaben dokumentiert
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dein vollständiger Name"
                maxLength={120}
                className="w-full rounded-[var(--v-radius)] bg-transparent px-3 py-2.5 text-[14px] outline-none"
                style={{ border: "1px solid var(--v-rule)", color: "var(--v-fg)" }}
              />
              <button
                type="button"
                onClick={() => setAgreed((a) => !a)}
                className="flex w-full items-start gap-2.5 text-left"
              >
                <span
                  aria-hidden
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] text-[12px] leading-none transition-colors"
                  style={{
                    border: `1.5px solid ${agreed ? "var(--v-fg)" : "var(--v-rule)"}`,
                    background: agreed ? "var(--v-fg)" : "transparent",
                    color: "var(--v-bg)",
                  }}
                >
                  {agreed ? "✓" : ""}
                </span>
                <span className="text-[13px] leading-snug" style={{ color: "var(--v-muted)" }}>
                  Ich habe den Plan und die Konditionen gelesen und stimme ihnen
                  verbindlich zu.
                </span>
              </button>
              <button
                type="button"
                onClick={sign}
                disabled={!name.trim() || !agreed || busy}
                className="w-full rounded-full px-4 py-2.5 text-[14px] font-medium transition-colors disabled:opacity-40"
                style={{ background: "var(--v-fg)", color: "var(--v-bg)" }}
              >
                {busy ? "…" : "Verbindlich zustimmen"}
              </button>
              <p className="mono text-[10px] leading-relaxed" style={{ color: "var(--v-muted)" }}>
                Mit dem Klick wird deine Zustimmung mit Name und Zeitstempel
                dokumentiert (Snapshot der Konditionen gespeichert).
              </p>
            </div>
          )}
        </div>
      </WidgetCard>
    </WidgetShell>
  );
}

function Party({
  label,
  value,
  isOwner,
  placeholder,
  onSave,
}: {
  label: string;
  value?: string;
  isOwner: boolean;
  placeholder: string;
  onSave: (v: string) => void;
}) {
  return (
    <div className="rounded-[var(--v-radius)] p-3" style={{ border: "1px solid var(--v-rule)" }}>
      <div className="mono mb-1 text-[10px] uppercase tracking-widest" style={{ color: "var(--v-muted)" }}>{label}</div>
      <InlineText
        value={value ?? ""}
        isOwner={isOwner}
        onSave={onSave}
        placeholder={placeholder}
        className="text-[14px] font-medium"
      />
    </div>
  );
}
