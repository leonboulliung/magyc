"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { ContractDraft, ContractSection } from "@/lib/contractDraft";
import type { HandoffInfo, ProjectStage } from "@/lib/types";
import { SignaturePad } from "@/components/studio/SignaturePad";
import {
  readApiJson,
  showApiError,
  showActionSuccess,
  showUnknownError,
} from "@/lib/client/feedback";

interface Signer { role: string; name: string; signedAt: string; place?: string; signature?: string }
interface SavedContract {
  parties: ContractDraft["parties"];
  clauses: ContractSection[];
  status: string;
  locked: boolean;
  signers: Signer[];
  owner_signed_at: string | null;
  client_signed_at: string | null;
  mode?: "click" | "draw" | string;
  draft_meta?: { model?: string; generatedAt?: number; gaps?: ContractDraft["gaps"]; signatureMode?: "click" | "draw" } | null;
}

function fmt(ts: string): string {
  try { return new Date(ts).toLocaleString("de-DE", { dateStyle: "long", timeStyle: "short" }); }
  catch { return ts; }
}

export function ContractView({ id, spaceTitle, embedded = false }: { id: string; spaceTitle: string; embedded?: boolean }) {
  const [loading, setLoading] = useState(true);
  const [isOwner, setIsOwner] = useState(false);
  const [accessRole, setAccessRole] = useState<"owner" | "editor" | "client" | "link">("link");
  const [maySign, setMaySign] = useState(true);
  const [contract, setContract] = useState<SavedContract | null>(null);
  const [draft, setDraft] = useState<ContractDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [signName, setSignName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [releaseSignatureMode, setReleaseSignatureMode] = useState<"click" | "draw" | null>(null);
  const [sigPlace, setSigPlace] = useState("");
  const [sigData, setSigData] = useState<string | null>(null);
  const [stage, setStage] = useState<ProjectStage | null>(null);
  const [handoff, setHandoff] = useState<HandoffInfo>({ note: "", links: [] });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${id}/contract`, { cache: "no-store" });
      const json = await readApiJson(res) as { isOwner?: boolean; accessRole?: "owner" | "editor" | "client" | "link"; canSign?: boolean; contract?: SavedContract | null; stage?: ProjectStage | null; handoff?: HandoffInfo };
      if (res.ok) {
        setIsOwner(!!json.isOwner);
        if (json.accessRole) setAccessRole(json.accessRole);
        setMaySign(json.canSign !== false);
        const nextContract = json.contract ?? null;
        setContract(nextContract);
        if (json.isOwner && nextContract && !nextContract.locked && (nextContract.status === "draft" || nextContract.status === "sent")) {
          setDraft({
            language: "de",
            title: spaceTitle,
            parties: nextContract.parties,
            sections: nextContract.clauses,
            gaps: Array.isArray(nextContract.draft_meta?.gaps) ? nextContract.draft_meta.gaps : [],
            generatedAt: nextContract.draft_meta?.generatedAt || Date.now(),
            model: nextContract.draft_meta?.model || "",
          });
          const storedMode = nextContract.draft_meta?.signatureMode;
          setReleaseSignatureMode(storedMode === "click" || storedMode === "draw" ? storedMode : null);
        } else {
          setDraft(null);
        }
        setStage(json.stage ?? null);
        if (json.handoff) setHandoff(json.handoff);
      }
    } catch {
      // best-effort; the empty state covers a failed load
    } finally {
      setLoading(false);
    }
  }, [id, spaceTitle]);

  useEffect(() => { void load(); }, [load]);

  async function generate() {
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${id}/contract/draft`, { method: "POST" });
      const json = await readApiJson(res);
      if (!res.ok) { showApiError("Entwurf fehlgeschlagen", json, { fallback: "Der Vertragsentwurf konnte nicht erzeugt werden." }); return; }
      const d = (json as { draft?: ContractDraft }).draft;
      if (d) {
        setDraft(d);
        setReleaseSignatureMode(null);
        await load();
      }
    } catch (e) { showUnknownError("Entwurf fehlgeschlagen", e); }
    finally { setBusy(false); }
  }

  function editClause(si: number, ci: number, value: string) {
    setDraft((d) => d ? {
      ...d,
      gaps: value.trim()
        ? d.gaps.filter((gap) => gap.clauseId !== d.sections[si]?.clauses[ci]?.id)
        : d.gaps,
      sections: d.sections.map((s, i) => i !== si ? s : {
        ...s,
        clauses: s.clauses.map((c, j) => j !== ci ? c : { ...c, value, source: c.source === "needs_input" && value ? "generated" : c.source }),
      }),
    } : d);
  }
  function editClient(field: keyof ContractDraft["parties"]["client"], value: string) {
    const gapId = field === "name" ? "ku_name" : field === "email" ? "ku_email" : null;
    setDraft((d) => d ? {
      ...d,
      gaps: value.trim() && gapId ? d.gaps.filter((gap) => gap.clauseId !== gapId) : d.gaps,
      parties: { ...d.parties, client: { ...d.parties.client, [field]: value } },
    } : d);
  }

  // Re-open an already-saved (but not yet released) contract for further edits.
  function editSaved() {
    if (!contract) return;
    setDraft({
      language: "de",
      title: spaceTitle,
      parties: contract.parties,
      sections: contract.clauses,
      gaps: Array.isArray(contract.draft_meta?.gaps) ? contract.draft_meta.gaps : [],
      generatedAt: contract.draft_meta?.generatedAt || Date.now(),
      model: contract.draft_meta?.model || "",
    });
  }

  async function release() {
    if (busy || !draft || !releaseSignatureMode) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${id}/contract/release`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          parties: draft.parties,
          clauses: draft.sections,
          draftMeta: {
            model: draft.model,
            generatedAt: draft.generatedAt,
            gaps: draft.gaps,
            signatureMode: releaseSignatureMode,
          },
          signatureMode: releaseSignatureMode,
        }),
      });
      const json = await readApiJson(res);
      if (!res.ok) { showApiError("Freigabe fehlgeschlagen", json, { fallback: "Der Vertrag konnte nicht freigegeben werden." }); return; }
      showActionSuccess("Vertrag zur Unterschrift freigegeben");
      await load();
    } catch (e) { showUnknownError("Freigabe fehlgeschlagen", e); }
    finally { setBusy(false); }
  }

  // The photographer chooses one method before release; both parties then use
  // that same documented signing method.
  const drawMode = contract?.mode === "draw";
  const canSign = !!signName.trim() && !busy && (drawMode ? !!sigData : agreed);

  async function sign() {
    if (!canSign) return;
    const n = signName.trim();
    setBusy(true);
    try {
      const body = drawMode
        ? { name: n, place: sigPlace.trim(), signature: sigData }
        : { name: n };
      const res = await fetch(`/api/projects/${id}/contract/sign`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const json = await readApiJson(res);
      if (!res.ok) { showApiError("Freigabe fehlgeschlagen", json, { fallback: "Die Freigabe konnte nicht erfasst werden." }); return; }
      const locked = (json as { locked?: boolean }).locked;
      showActionSuccess(locked ? "Vertrag verbindlich abgeschlossen" : "Freigabe erfasst");
      setAgreed(false); setSignName(""); setSigData(null); setSigPlace("");
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
  // The owner's plan lives in the workspace (/studio/[id], which carries the
  // project bar + stage stepper); the client's lives at the public /s/[id].
  // Sending the owner to /s/[id] would strip their nav and trap them.
  const planHref = accessRole === "owner" || accessRole === "editor" ? `/studio/${id}` : `/s/${id}`;

  // Draft edits are persisted quietly; release still sends the complete
  // reviewed document atomically so a stale autosave can never be signed.
  useEffect(() => {
    if (!draft || !isOwner || !preparing || contract?.locked) return;
    const timer = window.setTimeout(() => {
      void fetch(`/api/projects/${id}/contract`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          parties: draft.parties,
          clauses: draft.sections,
          draftMeta: {
            model: draft.model,
            generatedAt: draft.generatedAt,
            gaps: draft.gaps,
            signatureMode: releaseSignatureMode,
          },
        }),
      });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [contract?.locked, draft, id, isOwner, preparing, releaseSignatureMode]);

  const inner = (
    <div className="print-document mx-auto w-full max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        {/* Reference header */}
        <p className="mono text-[11px] uppercase tracking-[0.22em] text-black/40">Aus dem Projektplan</p>
        <h1 className="mt-2 font-brand text-[26px] font-bold tracking-[-0.02em] sm:text-[34px]">
          {draft?.title || spaceTitle || "Vertrag"}
        </h1>

        {loading ? (
          <div className="mt-8 space-y-4">{[0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-white/[0.04]" />)}</div>
        ) : clientWaiting ? (
          // Client, contract not yet released — show only a "wird vorbereitet" page.
          <div className="mt-8 rounded-2xl border border-black/12 bg-white p-6 sm:p-8 print:hidden">
            <div className="mono text-[10px] uppercase tracking-widest text-black/40">In Vorbereitung</div>
            <h2 className="mt-2 text-[18px] font-semibold">Dein Vertrag wird gerade vorbereitet</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-black/60">
              Die Fotograf:in stellt den Vertrag zu diesem Projekt fertig. Sobald er
              freigegeben ist, kannst du ihn hier in Ruhe lesen und verbindlich freigeben.
            </p>
            <Link href={planHref} className="mono mt-5 inline-flex items-center gap-1.5 text-[12px] tracking-widest text-black/55 transition-colors hover:text-[#17171a]">
              Zum Projektplan →
            </Link>
          </div>
        ) : !contract && !draft ? (
          // Owner empty state — no contract yet.
          <div className="mt-8 rounded-2xl border border-black/12 bg-white p-6 sm:p-8 print:hidden">
            <p className="text-[15px] leading-relaxed text-black/70">
              MAGYC erstellt aus deinem Plan und deinen hinterlegten Konditionen
              automatisch einen Vertragsentwurf. Falls die automatische Erstellung
              unterbrochen wurde, kannst du sie hier erneut anstoßen.
            </p>
            <button type="button" onClick={generate} disabled={busy} className="mt-5 rounded-full bg-[#17171a] px-5 py-2.5 text-[14px] font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50">
              {busy ? "Entwurf wird erzeugt …" : "Entwurf erneut vorbereiten"}
            </button>
          </div>
        ) : (
          <>
            {/* Locked banner */}
            {contract?.locked && (
              <div className="mt-6 rounded-2xl p-4" style={{ border: "1px solid rgba(34,197,94,0.35)", background: "rgba(34,197,94,0.08)" }}>
                <div className="text-[15px] font-medium">✓ Verbindlich abgeschlossen</div>
                <div className="mt-2 space-y-2 text-[13px] text-black/60">
                  {(contract.signers || []).map((s, i) => (
                    <div key={i}>
                      <div>
                        {s.role === "photographer" ? "Fotograf:in" : "Kunde"}: <span className="text-black/85">{s.name}</span>
                        {s.place ? ` · ${s.place}` : ""} · {fmt(s.signedAt)}
                      </div>
                      {s.signature && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.signature} alt="Signatur" className="mt-1 h-12 rounded bg-white/90 px-1" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Client, after signing — project in production, or closed (handoff). */}
            {contract?.locked && !isOwner && (
              <div className="mt-4 rounded-2xl border border-black/12 bg-white p-5 print:hidden">
                <div className="text-[15px] font-medium">{stage === "handoff" ? "Projekt abgeschlossen" : "Dein Projekt ist in Arbeit"}</div>
                <p className="mt-1 text-[13px] leading-relaxed text-black/60">
                  {stage === "handoff"
                    ? "Das Projekt ist abgeschlossen. Unten findest du die finalen Referenzen; Vertrag und Projektplan bleiben einsehbar."
                    : "Der Vertrag ist verbindlich abgeschlossen. Den unterschriebenen Vertrag und den Projektplan kannst du jederzeit hier einsehen."}
                </p>
                {(handoff.note || handoff.links.length > 0) && (
                  <div className="mt-4 space-y-3 border-t border-black/10 pt-4">
                    {handoff.note && <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-black/85">{handoff.note}</p>}
                    {handoff.links.map((l, i) => (
                      <a key={i} href={l.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 rounded-xl border border-black/10 bg-white px-3.5 py-2.5 text-[14px] text-black/85 transition-colors hover:border-black/25 hover:text-[#17171a]">
                        <span aria-hidden className="text-black/30">↗</span>
                        <span className="truncate">{l.label}</span>
                      </a>
                    ))}
                  </div>
                )}
                <Link href={planHref} className="mono mt-4 inline-flex items-center gap-1.5 text-[12px] tracking-widest text-black/55 transition-colors hover:text-[#17171a]">
                  Zum Projektplan →
                </Link>
              </div>
            )}

            {/* The document */}
            <div className="mt-6 overflow-hidden rounded-2xl border border-black/12">
              {parties?.photographer && parties?.client && (
                <div className="print-keep grid gap-px bg-white/10 sm:grid-cols-2">
                  <PartyBlock title="Dienstleister" lines={[parties.photographer.studio || parties.photographer.name, parties.photographer.name, parties.photographer.email, parties.photographer.address, parties.photographer.vatId ? `USt-IdNr. ${parties.photographer.vatId}` : (parties.photographer.kleinunternehmer19 ? "Kleinunternehmer §19 UStG" : "")]} />
                  {editing ? (
                    <div className="bg-white p-4">
                      <div className="mono mb-2 text-[10px] uppercase tracking-widest text-black/40">Kunde</div>
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
                  <div key={section.id} className="print-keep border-t border-black/10 p-4 sm:p-5">
                    <div className="mono mb-3 text-[10px] uppercase tracking-[0.2em] text-black/40">{section.title}</div>
                    <dl className="space-y-3">
                      {section.clauses.map((c, ci) => (
                        <div key={c.id} className="grid gap-1 sm:grid-cols-[160px_1fr] sm:gap-4">
                          <dt className="text-[13px] text-black/50">{c.label}</dt>
                          <dd>
                            {editing ? (
                              <textarea
                                value={c.value}
                                onChange={(e) => editClause(realIndex, ci, e.target.value)}
                                rows={1}
                                placeholder={c.source === "needs_input" ? (draft?.gaps.find((g) => g.clauseId === c.id)?.hint ?? "Angabe ergänzen") : "Vertragsinhalt ergänzen"}
                                className={`w-full resize-y rounded-lg border bg-white px-2.5 py-1.5 text-[14px] leading-snug text-[#17171a] outline-none focus:border-black/35 [field-sizing:content] min-h-[2.4rem] ${c.source === "needs_input" ? "border-amber-400/40" : "border-black/12"}`}
                              />
                            ) : (
                              <span className="whitespace-pre-wrap break-words text-[14px] leading-snug text-black/90">{c.value || "—"}</span>
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </div>
                );
              })}
            </div>

            {/* Owner: edit, choose the signing method, release in one step. */}
            {editing && (
              <div className="mt-5 rounded-2xl border border-black/12 bg-white p-5 print:hidden">
                {draft && draft.gaps.length > 0 && (
                  <p className="mb-4 text-[13px] text-amber-700">{draft.gaps.length} Feld(er) brauchen noch deine Eingabe (gelb markiert).</p>
                )}
                <div className="text-[14px] font-medium">Wie wird unterschrieben?</div>
                <p className="mt-1 text-[12px] leading-relaxed text-black/50">Diese Wahl gilt für Fotograf:in und Kund:in und wird im Prüfprotokoll dokumentiert.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => setReleaseSignatureMode("click")} className={`rounded-xl border px-4 py-3 text-left transition-colors ${releaseSignatureMode === "click" ? "border-[#17171a] bg-[#17171a] text-white" : "border-black/12 text-black/65 hover:border-black/30 hover:text-black"}`}>
                    <span className="block text-[13px] font-medium">Textbestätigung</span>
                    <span className={`mt-0.5 block text-[11px] ${releaseSignatureMode === "click" ? "text-white/65" : "text-black/40"}`}>Name, Zustimmung und Zeitstempel</span>
                  </button>
                  <button type="button" onClick={() => setReleaseSignatureMode("draw")} className={`rounded-xl border px-4 py-3 text-left transition-colors ${releaseSignatureMode === "draw" ? "border-[#17171a] bg-[#17171a] text-white" : "border-black/12 text-black/65 hover:border-black/30 hover:text-black"}`}>
                    <span className="block text-[13px] font-medium">Gezeichnete Unterschrift</span>
                    <span className={`mt-0.5 block text-[11px] ${releaseSignatureMode === "draw" ? "text-white/65" : "text-black/40"}`}>Signatur, Ort und Zeitstempel</span>
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={release} disabled={busy || !releaseSignatureMode} className="rounded-full bg-[#17171a] px-5 py-2.5 text-[14px] font-medium text-white transition-opacity hover:opacity-85 disabled:opacity-35">
                    {busy ? "…" : "Zur Unterschrift freigeben"}
                  </button>
                  <span className="mono text-[10px] tracking-widest text-black/35">Änderungen werden automatisch gespeichert</span>
                </div>
              </div>
            )}

            {/* Owner, contract prepared but not released — edit further or release for signing. */}
            {isOwner && preparing && !editing && (
              <div className="mt-6 rounded-2xl border border-black/12 bg-white p-5 print:hidden">
                <div className="text-[14px] font-medium">Bereit zur Freigabe</div>
                <p className="mt-1 text-[13px] leading-relaxed text-black/60">
                  Solange du nicht freigibst, sieht dein Kunde nur eine Vorbereitungs-Seite.
                  Mit der Freigabe wird der Vertrag für beide zur Unterschrift geöffnet.
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <button type="button" onClick={editSaved} disabled={busy} className="mono rounded-full border border-black/15 px-4 py-2.5 text-[12px] tracking-widest text-black/55 hover:text-[#17171a] disabled:opacity-50">
                    Bearbeiten
                  </button>
                </div>
              </div>
            )}

            {/* Sign-off (released, not locked, and this viewer hasn't signed) */}
            {released && maySign && !editing && !iSigned && (
              <div className="mt-6 rounded-2xl border border-black/12 bg-white p-5 print:hidden">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-[14px] font-medium">Verbindlich freigeben ({myRole === "photographer" ? "Fotograf:in" : "Kunde"})</div>
                  <span className="mono text-[10px] uppercase tracking-widest text-black/35">{drawMode ? "Unterschrift" : "Textbestätigung"}</span>
                </div>
                <input value={signName} onChange={(e) => setSignName(e.target.value)} placeholder="Dein vollständiger Name" maxLength={120} className={`${fieldClass} mt-3`} />

                {drawMode ? (
                  <div className="mt-3 space-y-3">
                    <SignaturePad onChange={setSigData} />
                    <input value={sigPlace} onChange={(e) => setSigPlace(e.target.value)} placeholder="Ort (z. B. Köln)" maxLength={160} className={fieldClass} />
                  </div>
                ) : (
                  <button type="button" onClick={() => setAgreed((a) => !a)} className="mt-3 flex w-full items-start gap-2.5 text-left">
                    <span aria-hidden className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] text-[12px] leading-none" style={{ border: `1.5px solid ${agreed ? "var(--studio-ink)" : "var(--studio-rule)"}`, background: agreed ? "var(--studio-ink)" : "transparent", color: "var(--studio-page)" }}>{agreed ? "✓" : ""}</span>
                    <span className="text-[13px] leading-snug text-black/60">Ich habe den Vertrag gelesen und stimme ihm verbindlich zu.</span>
                  </button>
                )}

                <button type="button" onClick={sign} disabled={!canSign} className="mt-3 w-full rounded-full bg-[#17171a] px-4 py-2.5 text-[14px] font-medium text-white transition-colors hover:opacity-90 disabled:opacity-40">
                  {busy ? "…" : "Verbindlich zustimmen"}
                </button>
                <p className="mono mt-2 text-[10px] leading-relaxed text-black/40">
                  {drawMode
                    ? "Deine gezeichnete Signatur, Ort und Zeitstempel werden dokumentiert (verbindliche Freigabe, Textform)."
                    : "Deine Zustimmung wird mit Name und Zeitstempel dokumentiert (verbindliche Freigabe, Textform)."}
                </p>
              </div>
            )}

            {/* Waiting note */}
            {released && !editing && iSigned && (
              <p className="mt-6 text-[14px] text-black/55 print:hidden">
                Deine Freigabe ist erfasst. {myRole === "photographer" ? "Warten auf die Freigabe des Kunden." : "Warten auf die Freigabe der Fotograf:in."}
              </p>
            )}
          </>
        )}
      </div>
  );

  if (embedded) return inner;
  return (
    <div className="min-h-screen bg-[#f4f4f1] text-[#17171a]">
      {/* Environment bar — clear transition + reference to the planning env */}
      <div className="sticky top-0 z-20 border-b border-black/10 bg-white/80 backdrop-blur-md print:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
          <Link href={planHref} className="mono inline-flex items-center gap-1.5 text-[12px] tracking-widest text-black/55 transition-colors hover:text-[#17171a]">
            ← Zur Planung
          </Link>
          <span className="mono text-[10px] uppercase tracking-[0.28em] text-black/40">Vertrag</span>
          {contract ? (
            <button type="button" onClick={() => window.print()} className="mono rounded-full bg-[#17171a] px-3.5 py-1.5 text-[12px] tracking-widest text-white transition-colors hover:opacity-90">
              Als PDF
            </button>
          ) : <span className="w-[64px]" />}
        </div>
      </div>
      {inner}
    </div>
  );
}

const fieldClass = "w-full rounded-lg border border-black/12 bg-white px-3 py-2 text-[14px] text-[#17171a] outline-none placeholder:text-black/30 focus:border-black/35";

function PartyBlock({ title, lines }: { title: string; lines: (string | undefined)[] }) {
  return (
    <div className="bg-white p-4">
      <div className="mono mb-2 text-[10px] uppercase tracking-widest text-black/40">{title}</div>
      <div className="space-y-0.5">
        {lines.filter(Boolean).map((l, i) => (
          <div key={i} className={`text-[13px] ${i === 0 ? "font-medium text-black/85" : "text-black/60"}`}>{l}</div>
        ))}
        {lines.filter(Boolean).length === 0 && <div className="text-[13px] text-black/35">—</div>}
      </div>
    </div>
  );
}
