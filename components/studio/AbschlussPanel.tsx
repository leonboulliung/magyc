"use client";

import { useState } from "react";
import Link from "next/link";
import type { HandoffInfo } from "@/lib/types";
import type { ProjectFacts } from "@/lib/projectFacts";
import { readApiJson, showApiError, showActionSuccess, showUnknownError } from "@/lib/client/feedback";
import { ProjectFactsSummary } from "@/components/projects/ProjectFactsSummary";

/**
 * AbschlussPanel — the closing surface of a project. The photographer attaches
 * a short note + reference links (final gallery, invoice, drive …); the client
 * sees the same, read-only, via the shared link, so opening the project after
 * closing immediately shows "abgeschlossen" plus everything handed over.
 */
export function AbschlussPanel({
  id,
  isOwner,
  initial,
  facts,
  planHref,
  contractHref,
  onView,
}: {
  id: string;
  isOwner: boolean;
  initial: HandoffInfo;
  facts?: ProjectFacts;
  /** Used for the client (separate routes). Ignored when onView is given. */
  planHref?: string;
  contractHref?: string;
  /** In the owner workspace, switch the embedded view instead of navigating. */
  onView?: (s: "brief" | "production") => void;
}) {
  const [note, setNote] = useState(initial.note);
  const [links, setLinks] = useState(initial.links);
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);

  async function save(next: { note: string; links: HandoffInfo["links"] }) {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ handoff: next }),
      });
      const json = await readApiJson(res);
      if (!res.ok) { showApiError("Nicht gespeichert", json, { fallback: "Der Abschluss konnte nicht gespeichert werden." }); return; }
      showActionSuccess("Abschluss gespeichert");
      setDirty(false);
    } catch (e) { showUnknownError("Nicht gespeichert", e); }
    finally { setBusy(false); }
  }

  function addLink() {
    const u = url.trim();
    if (!u) return;
    const next = [...links, { label: label.trim() || u, url: u }].slice(0, 20);
    setLinks(next);
    setLabel(""); setUrl("");
    void save({ note, links: next });
  }
  function removeLink(i: number) {
    const next = links.filter((_, j) => j !== i);
    setLinks(next);
    void save({ note, links: next });
  }

  const field = "w-full rounded-lg border border-black/12 bg-white px-3 py-2 text-[14px] text-[#17171a] outline-none placeholder:text-black/30 focus:border-black/35";

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
      <div className="rounded-2xl p-5" style={{ border: "1px solid rgba(34,197,94,0.35)", background: "rgba(34,197,94,0.08)" }}>
        <div className="mono text-[10px] uppercase tracking-widest text-emerald-700">Abschluss</div>
        <h1 className="mt-1.5 font-brand text-[24px] font-bold tracking-[-0.02em] text-[#17171a] sm:text-[30px]">Projekt abgeschlossen</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-black/65">
          {isOwner
            ? "Häng deinem Kunden hier die finalen Referenzen an — Galerie, Rechnung, Ordner. Er sieht sie über den Teilen-Link."
            : "Das Projekt ist abgeschlossen. Unten findest du die finalen Referenzen deiner Fotograf:in."}
        </p>
      </div>

      {facts && <ProjectFactsSummary facts={facts} title="Abschließender Projektstand" className="mt-6" />}

      {/* Note */}
      <div className="mt-5">
        <div className="mono mb-2 text-[10px] uppercase tracking-widest text-black/40">Abschluss-Notiz</div>
        {isOwner ? (
          <textarea
            value={note}
            onChange={(e) => { setNote(e.target.value); setDirty(true); }}
            onBlur={() => { if (dirty) void save({ note, links }); }}
            rows={3}
            maxLength={2000}
            placeholder="z. B. Vielen Dank für die Zusammenarbeit! Hier sind alle Ergebnisse …"
            className={`${field} resize-none leading-relaxed`}
          />
        ) : note ? (
          <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-black/85">{note}</p>
        ) : (
          <p className="text-[14px] text-black/35">—</p>
        )}
      </div>

      {/* Links */}
      <div className="mt-6">
        <div className="mono mb-2 text-[10px] uppercase tracking-widest text-black/40">Referenzen & Links</div>
        <div className="space-y-2">
          {links.length === 0 && !isOwner && <p className="text-[14px] text-black/35">Keine Links angehängt.</p>}
          {links.map((l, i) => (
            <div key={i} className="group flex items-center gap-3 rounded-xl border border-black/10 bg-white px-3.5 py-2.5">
              <span aria-hidden className="text-black/30">↗</span>
              <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex-1 truncate text-[14px] text-black/85 hover:text-[#17171a]">{l.label}</a>
              {isOwner && (
                <button type="button" onClick={() => removeLink(i)} aria-label="Entfernen" className="text-black/30 opacity-0 transition-opacity hover:text-[#17171a] group-hover:opacity-100">×</button>
              )}
            </div>
          ))}
        </div>
        {isOwner && (
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Bezeichnung (optional)" maxLength={120} className={`${field} sm:w-1/3`} />
            <input value={url} onChange={(e) => setUrl(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLink(); } }} placeholder="https://…" maxLength={600} className={field} />
            <button type="button" onClick={addLink} disabled={!url.trim() || busy} className="shrink-0 rounded-lg bg-[#17171a] px-4 py-2 text-[14px] font-medium text-white transition-colors hover:opacity-90 disabled:opacity-40">
              Hinzufügen
            </button>
          </div>
        )}
      </div>

      {/* Cross-links */}
      <div className="mt-8 flex flex-wrap gap-4 border-t border-black/10 pt-5">
        {onView ? (
          <>
            <button type="button" onClick={() => onView("brief")} className="mono text-[12px] tracking-widest text-black/55 transition-colors hover:text-[#17171a]">Projektplan ansehen →</button>
            <button type="button" onClick={() => onView("production")} className="mono text-[12px] tracking-widest text-black/55 transition-colors hover:text-[#17171a]">Vertrag ansehen →</button>
          </>
        ) : (
          <>
            <Link href={planHref ?? "#"} className="mono text-[12px] tracking-widest text-black/55 transition-colors hover:text-[#17171a]">Projektplan ansehen →</Link>
            <Link href={contractHref ?? "#"} className="mono text-[12px] tracking-widest text-black/55 transition-colors hover:text-[#17171a]">Vertrag ansehen →</Link>
          </>
        )}
      </div>
    </div>
  );
}
