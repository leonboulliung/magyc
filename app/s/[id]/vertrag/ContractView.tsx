"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { ContractDraft, ContractSection } from "@/lib/contractDraft";
import {
  readApiJson,
  showApiError,
  showActionSuccess,
  showUnknownError,
} from "@/lib/client/feedback";

interface Signer { role: string; name: string; signedAt: string }
interface SavedContract {
  parties: ContractDraft["parties"];
  clauses: ContractSection[];
  status: string;
  locked: boolean;
  signers: Signer[];
  owner_signed_at: string | null;
  client_signed_at: string | null;
}

function fmt(ts: string): string {
  try { return new Date(ts).toLocaleString("de-DE", { dateStyle: "long", timeStyle: "short" }); }
  catch { return ts; }
}

export function ContractView({ id, spaceTitle }: { id: string; spaceTitle: string }) {
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [contract, setContract] = useState<SavedContract | null>(null);
  const [draft, setDraft] = useState<ContractDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [signName, setSignName] = useState("");
  const [agreed, setAgreed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}/contract`, { cache: "no-store" });
      const json = await readApiJson(res) as { isOwner?: boolean; contract?: SavedContract | null };
      if (res.ok) {
        setIsOwner(!!json.isOwner);
        setContract(json.contract ?? null);
      }
    } catch {
      // best-effort; the empty state covers a failed load
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);

  async function generate() {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${id}/contract/draft`, { method: "POST" });
      const json = await readApiJson(res);
      if (!res.ok) { showApiError("Entwurf fehlgeschlagen", json, { fallback: "Der Vertragsentwurf konnte nicht erzeugt werden." }); return; }
      const d = (json as { draft?: ContractDraft }).draft;
      if (d) setDraft(d);
    } catch (e) { showUnknownError("Entwurf fehlgeschlagen", e); }
    finally { setBusy(false); }
  }

  function editClause(si: number, ci: number, value: string) {
    setDraft((d) => d ? {
      ...d,
      sections: d.sections.map((s, i) => i !== si ? s : {
        ...s,
        clauses: s.clauses.map((c, j) => j !== ci ? c : { ...c, value, source: c.source === "needs_input" && value ? "generated" : c.source }),
      }),
    } : d);
  }
  function editClient(field: keyof ContractDraft["parties"]["client"], value: string) {
    setDraft((d) => d ? { ...d, parties: { ...d.parties, client: { ...d.parties.client, [field]: value } } } : d);
  }

  // Re-open an already-saved (but not yet released) contract for further edits.
  function editSaved() {
    if (!contract) return;
    setDraft({
      language: "de",
      title: spaceTitle,
      parties: contract.parties,
      sections: contract.clauses,
      gaps: [],
      generatedAt: Date.now(),
      model: "",
    });
  }

  async function release() {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${id}/contract/release`, { method: "POST" });
      const json = await readApiJson(res);
      if (!res.ok) { showApiError("Freigabe fehlgeschlagen", json, { fallback: "Der Vertrag konnte nicht freigegeben werden." }); return; }
      showActionSuccess("Vertrag zur Unterschrift freigegeben");
      await load();
    } catch (e) { showUnknownError("Freigabe fehlgeschlagen", e); }
    finally { setBusy(false); }
  }

  async function finalize() {
    if (!draft) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${id}/contract`, {
        method: "PUT", headers: { "content-type": "application/json" },
        body: JSON.stringify({ parties: draft.parties, clauses: draft.sections, draftMeta: { model: draft.model, generatedAt: draft.generatedAt } }),
      });
      const json = await readApiJson(res);
      if (!res.ok) { showApiError("Nicht gespeichert", json, { fallback: "Der Vertrag konnte nicht festgelegt werden." }); return; }
      showActionSuccess("Vertrag festgelegt");
      setDraft(null);
      await load();
    } catch (e) { showUnknownError("Nicht gespeichert", e); }
    finally { setBusy(false); }
  }

  async function sign() {
    const n = signName.trim();
    if (!n || !agreed || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${id}/contract/sign`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: n }),
      });
      const json = await readApiJson(res);
      if (!res.ok) { showApiError("Freigabe fehlgeschlagen", json, { fallback: "Die Freigabe konnte nicht erfasst werden." }); return; }
      const locked = (json as { locked?: boolean }).locked;
      showActionSuccess(locked ? "Vertrag verbindlich abgeschlossen" : "Freigabe erfasst");
      setAgreed(false); setSignName("");
      await load();
    } catch (e) { showUnknownError("Freigabe fehlgeschlagen", e); }
    finally { setBusy(false); }
  }

  const ownerSigned = !!contract?.owner_signed_at;
  const clientSigned = !!contract?.client_signed_at;
  const myRole: "photographer" | "client" = isOwner ? "photographer" : "client";
  const iSigned = myRole === "photographer" ? ownerSigned : clientSigned;
  const sections = draft ? draft.sections : contract?.clauses ?? [];
  const parties = draft ? draft.parties : contract?.parties;
  const editing = !!draft && !contract?.locked;
  // Lifecycle: "sent"/"draft" = owner still preparing; "released" and the
  // partial-sign statuses = open for signatures; locked = done.
  const status = contract?.status ?? "";
  const preparing = !!contract && !contract.locked && (status === "sent" || status === "draft");
  const released = !!contract && !contract.locked && !preparing;
  // The client never sees the document while it is still being prepared.
  const clientWaiting = !isOwner && (!contract || preparing) && !draft;

  return (
    <div className="min-h-screen text-white" style={{ background: "radial-gradient(circle at 50% -10%, #14171c, #050505 60%)" }}>
      {/* Environment bar — clear transition + reference to the planning env */}
      <div className="sticky top-0 z-20 border-b border-white/10 bg-black/70 backdrop-blur-md print:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <Link href={`/s/${id}`} className="mono inline-flex items-center gap-1.5 text-[12px] tracking-widest text-white/55 transition-colors hover:text-white">
            ← Zur Planung
          </Link>
          <span className="mono text-[10px] uppercase tracking-[0.28em] text-white/40">Absegnung · Vertrag</span>
          {contract?.locked ? (
            <button type="button" onClick={() => window.print()} className="mono rounded-full bg-white px-3.5 py-1.5 text-[12px] tracking-widest text-black transition-colors hover:bg-white/85">
              Als PDF
            </button>
          ) : <span className="w-[64px]" />}
        </div>
      </div>

      <div className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        {/* Reference header */}
        <p className="mono text-[11px] uppercase tracking-[0.22em] text-white/40">Aus dem Projektplan</p>
        <h1 className="mt-2 font-brand text-[26px] font-bold tracking-[-0.02em] sm:text-[34px]">
          {draft?.title || spaceTitle || "Vertrag"}
        </h1>

        {loading ? (
          <div className="mt-8 space-y-4">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/[0.04]" />)}</div>
        ) : clientWaiting ? (
          // Client, contract not yet released — show only a "wird vorbereitet" page.
          <div className="mt-8 rounded-2xl border border-white/12 bg-white/[0.02] p-6 sm:p-8 print:hidden">
            <div className="mono text-[10px] uppercase tracking-widest text-white/40">In Vorbereitung</div>
            <h2 className="mt-2 text-[18px] font-semibold">Dein Vertrag wird gerade vorbereitet</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-white/60">
              Die Fotograf:in stellt den Vertrag zu diesem Projekt fertig. Sobald er
              freigegeben ist, kannst du ihn hier in Ruhe lesen und verbindlich freigeben.
            </p>
            <Link href={`/s/${id}`} className="mono mt-5 inline-flex items-center gap-1.5 text-[12px] tracking-widest text-white/55 transition-colors hover:text-white">
              Zum Projektplan →
            </Link>
          </div>
        ) : !contract && !draft ? (
          // Owner empty state — no contract yet.
          <div className="mt-8 rounded-2xl border border-white/12 bg-white/[0.02] p-6 sm:p-8 print:hidden">
            <p className="text-[15px] leading-relaxed text-white/70">
              MAGYC erstellt aus deinem Plan und deinen hinterlegten Konditionen
              automatisch einen Vertragsentwurf. Du prüfst ihn, ergänzt das Honorar
              und gibst ihn frei.
            </p>
            <button type="button" onClick={generate} disabled={busy} className="mt-5 rounded-full bg-white px-5 py-2.5 text-[14px] font-medium text-black transition-colors hover:bg-white/85 disabled:opacity-50">
              {busy ? "Entwurf wird erzeugt …" : "Vertragsentwurf erzeugen"}
            </button>
          </div>
        ) : (
          <>
            {/* Locked banner */}
            {contract?.locked && (
              <div className="mt-6 rounded-2xl p-4" style={{ border: "1px solid rgba(34,197,94,0.35)", background: "rgba(34,197,94,0.08)" }}>
                <div className="text-[15px] font-medium">✓ Verbindlich abgeschlossen</div>
                <div className="mt-1 space-y-0.5 text-[13px] text-white/60">
                  {(contract.signers || []).map((s, i) => (
                    <div key={i}>{s.role === "photographer" ? "Fotograf:in" : "Kunde"}: <span className="text-white/85">{s.name}</span> · {fmt(s.signedAt)}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Client, after signing — the project is now in production. */}
            {contract?.locked && !isOwner && (
              <div className="mt-4 rounded-2xl border border-white/12 bg-white/[0.02] p-5 print:hidden">
                <div className="text-[15px] font-medium">Dein Projekt ist in Arbeit</div>
                <p className="mt-1 text-[13px] leading-relaxed text-white/60">
                  Der Vertrag ist verbindlich abgeschlossen. Den unterschriebenen
                  Vertrag und den Projektplan kannst du jederzeit hier einsehen.
                </p>
                <Link href={`/s/${id}`} className="mono mt-4 inline-flex items-center gap-1.5 text-[12px] tracking-widest text-white/55 transition-colors hover:text-white">
                  Zum Projektplan →
                </Link>
              </div>
            )}

            {/* The document */}
            <div className="mt-6 overflow-hidden rounded-2xl border border-white/12">
              {parties?.photographer && parties?.client && (
                <div className="grid gap-px bg-white/10 sm:grid-cols-2">
                  <PartyBlock title="Dienstleister" lines={[parties.photographer.studio || parties.photographer.name, parties.photographer.name, parties.photographer.email, parties.photographer.address, parties.photographer.vatId ? `USt-IdNr. ${parties.photographer.vatId}` : (parties.photographer.kleinunternehmer19 ? "Kleinunternehmer §19 UStG" : "")]} />
                  {editing ? (
                    <div className="bg-[#0b0d10] p-4">
                      <div className="mono mb-2 text-[10px] uppercase tracking-widest text-white/40">Kunde</div>
                      <div className="space-y-2">
                        <input value={parties.client.name} onChange={(e) => editClient("name", e.target.value)} placeholder="Name" className={fieldClass} />
                        <input value={parties.client.email} onChange={(e) => editClient("email", e.target.value)} placeholder="E-Mail" className={fieldClass} />
                        <input value={parties.client.address} onChange={(e) => editClient("address", e.target.value)} placeholder="Anschrift" className={fieldClass} />
                      </div>
                    </div>
                  ) : (
                    <PartyBlock title="Kunde" lines={[parties.client.name, parties.client.email, parties.client.address, parties.client.company]} />
                  )}
                </div>
              )}

              {sections.filter((s) => s.id !== "dienstleister" && s.id !== "kunde").map((section, si) => {
                const realIndex = sections.indexOf(section);
                return (
                  <div key={section.id} className="border-t border-white/10 p-4 sm:p-5">
                    <div className="mono mb-3 text-[10px] uppercase tracking-[0.2em] text-white/40">{section.title}</div>
                    <dl className="space-y-3">
                      {section.clauses.map((c, ci) => (
                        <div key={c.id} className="grid gap-1 sm:grid-cols-[160px_1fr] sm:gap-4">
                          <dt className="text-[13px] text-white/50">{c.label}</dt>
                          <dd>
                            {editing ? (
                              <textarea
                                value={c.value}
                                onChange={(e) => editClause(realIndex, ci, e.target.value)}
                                rows={c.value.length > 60 ? 2 : 1}
                                placeholder={c.source === "needs_input" ? (draft?.gaps.find((g) => g.clauseId === c.id)?.hint ?? "…") : "…"}
                                className={`w-full resize-none rounded-lg border bg-white/[0.03] px-2.5 py-1.5 text-[14px] leading-snug text-white outline-none focus:border-white/35 ${c.source === "needs_input" ? "border-amber-400/40" : "border-white/12"}`}
                              />
                            ) : (
                              <span className="whitespace-pre-wrap break-words text-[14px] leading-snug text-white/90">{c.value || "—"}</span>
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                );
              })}
            </div>

            {/* Owner: gaps + finalize */}
            {editing && (
              <div className="mt-5 print:hidden">
                {draft && draft.gaps.length > 0 && (
                  <p className="mb-3 text-[13px] text-amber-300/80">{draft.gaps.length} Feld(er) brauchen noch deine Eingabe (gelb markiert).</p>
                )}
                <div className="flex flex-wrap gap-3">
                  <button type="button" onClick={finalize} disabled={busy} className="rounded-full bg-white px-5 py-2.5 text-[14px] font-medium text-black transition-colors hover:bg-white/85 disabled:opacity-50">
                    {busy ? "…" : "Vertrag festlegen"}
                  </button>
                  <button type="button" onClick={() => setDraft(null)} className="mono rounded-full border border-white/15 px-4 py-2.5 text-[12px] tracking-widest text-white/55 hover:text-white">
                    Verwerfen
                  </button>
                </div>
              </div>
            )}

            {/* Owner, contract prepared but not released — edit further or release for signing. */}
            {isOwner && preparing && !editing && (
              <div className="mt-6 rounded-2xl border border-white/12 bg-white/[0.02] p-5 print:hidden">
                <div className="text-[14px] font-medium">Bereit zur Freigabe</div>
                <p className="mt-1 text-[13px] leading-relaxed text-white/60">
                  Solange du nicht freigibst, sieht dein Kunde nur eine Vorbereitungs-Seite.
                  Mit der Freigabe wird der Vertrag für beide zur Unterschrift geöffnet.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button type="button" onClick={release} disabled={busy} className="rounded-full bg-white px-5 py-2.5 text-[14px] font-medium text-black transition-colors hover:bg-white/85 disabled:opacity-50">
                    {busy ? "…" : "Zur Unterschrift freigeben"}
                  </button>
                  <button type="button" onClick={editSaved} disabled={busy} className="mono rounded-full border border-white/15 px-4 py-2.5 text-[12px] tracking-widest text-white/55 hover:text-white disabled:opacity-50">
                    Bearbeiten
                  </button>
                </div>
              </div>
            )}

            {/* Sign-off (released, not locked, and this viewer hasn't signed) */}
            {released && !editing && !iSigned && (
              <div className="mt-6 rounded-2xl border border-white/12 bg-white/[0.02] p-5 print:hidden">
                <div className="text-[14px] font-medium">Verbindlich freigeben ({myRole === "photographer" ? "Fotograf:in" : "Kunde"})</div>
                <input value={signName} onChange={(e) => setSignName(e.target.value)} placeholder="Dein vollständiger Name" maxLength={120} className={`${fieldClass} mt-3`} />
                <button type="button" onClick={() => setAgreed((a) => !a)} className="mt-3 flex w-full items-start gap-2.5 text-left">
                  <span aria-hidden className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] text-[12px] leading-none" style={{ border: `1.5px solid ${agreed ? "#fff" : "rgba(255,255,255,0.3)"}`, background: agreed ? "#fff" : "transparent", color: "#000" }}>{agreed ? "✓" : ""}</span>
                  <span className="text-[13px] leading-snug text-white/60">Ich habe den Vertrag gelesen und stimme ihm verbindlich zu.</span>
                </button>
                <button type="button" onClick={sign} disabled={!signName.trim() || !agreed || busy} className="mt-3 w-full rounded-full bg-white px-4 py-2.5 text-[14px] font-medium text-black transition-colors hover:bg-white/85 disabled:opacity-40">
                  {busy ? "…" : "Verbindlich zustimmen"}
                </button>
                <p className="mono mt-2 text-[10px] leading-relaxed text-white/40">Deine Zustimmung wird mit Name und Zeitstempel dokumentiert (verbindliche Freigabe, Textform).</p>
              </div>
            )}

            {/* Waiting note */}
            {released && !editing && iSigned && (
              <p className="mt-6 text-[14px] text-white/55 print:hidden">
                Deine Freigabe ist erfasst. {myRole === "photographer" ? "Warten auf die Freigabe des Kunden." : "Warten auf die Freigabe der Fotograf:in."}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const fieldClass = "w-full rounded-lg border border-white/12 bg-white/[0.03] px-3 py-2 text-[14px] text-white outline-none placeholder:text-white/30 focus:border-white/35";

function PartyBlock({ title, lines }: { title: string; lines: (string | undefined)[] }) {
  return (
    <div className="bg-[#0b0d10] p-4">
      <div className="mono mb-2 text-[10px] uppercase tracking-widest text-white/40">{title}</div>
      <div className="space-y-0.5">
        {lines.filter(Boolean).map((l, i) => (
          <div key={i} className={`text-[13px] ${i === 0 ? "font-medium text-white" : "text-white/60"}`}>{l}</div>
        ))}
        {lines.filter(Boolean).length === 0 && <div className="text-[13px] text-white/35">—</div>}
      </div>
    </div>
  );
}
