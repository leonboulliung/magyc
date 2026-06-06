"use client";

import { useState } from "react";
import { Icon } from "@iconify/react";
import { MODULE_META } from "@/lib/modules";
import {
  addsFor, checksFor, claimsFor, getAnonToken, latestEdit, myVote, postState, voicesFor, voteCounts,
} from "@/lib/state";
import type { Module, ModuleStateEntry } from "@/lib/types";

/* ============================================================
   Dispatcher
   ============================================================ */

export function ModuleRenderer({
  spaceId,
  module: m,
  moduleIndex,
  state,
  onChanged,
}: {
  spaceId: string;
  module: Module;
  moduleIndex: number;
  state: ModuleStateEntry[];
  onChanged: () => void;
}) {
  const props = { spaceId, moduleIndex, state, onChanged };
  switch (m.type) {
    case "headline":      return <Headline m={m} {...props} />;
    case "tags":          return <Tags m={m} {...props} />;
    case "notes":         return <Notes m={m} {...props} />;
    case "open_question": return <OpenQuestion m={m} {...props} />;
    case "poll":          return <Poll m={m} {...props} />;
    case "checklist":     return <Checklist m={m} {...props} />;
    case "help_slots":    return <HelpSlots m={m} {...props} />;
    case "stages":        return <Stages m={m} {...props} />;
    case "number_block":  return <NumberBlock m={m} {...props} />;
    case "icon":          return <IconRender m={m} {...props} />;
    case "palette":       return <Palette m={m} {...props} />;
    case "map":           return <MapRender m={m} {...props} />;
    case "time":          return <TimeRender m={m} {...props} />;
    case "knowledge":     return <Knowledge m={m} {...props} />;
    case "framework":     return <Framework m={m} {...props} />;
    case "typography":    return <Typography m={m} {...props} />;
    case "formula":       return <Formula m={m} {...props} />;
    case "chart":         return <Chart m={m} {...props} />;
    case "image":         return <ImageMod m={m} {...props} />;
  }
}

/* ============================================================
   Frame — common shell every module renders into
   ============================================================ */

function ModuleFrame({
  module: m,
  children,
  bare = false,
}: {
  module: Module;
  children: React.ReactNode;
  bare?: boolean;
}) {
  const meta = MODULE_META[m.type];
  return (
    <section className={bare ? "" : "vibe-card p-4 sm:p-5"}>
      {!bare && (
        <header className="mb-3 flex items-baseline justify-between gap-3">
          <div className="mono text-[10px] tracking-widest vibe-muted uppercase">
            {m.label}
          </div>
          {meta.dataSource && (
            <span className="mono text-[9px] tracking-widest vibe-muted opacity-60">
              {meta.dataSource}
            </span>
          )}
        </header>
      )}
      {children}
      {m.description && !bare && (
        <p className="mono text-[10px] vibe-muted mt-3">{m.description}</p>
      )}
      {m.attribution && (
        <p className="mono text-[9px] vibe-muted mt-2 opacity-60">
          ↗ {m.attribution.name} ·{" "}
          <a href={m.attribution.url} target="_blank" rel="noreferrer noopener" className="underline">
            {m.attribution.license}
          </a>
        </p>
      )}
    </section>
  );
}

/* ============================================================
   Tier A — no data source
   ============================================================ */

function Headline({ m }: RProps<"headline">) {
  return (
    <ModuleFrame module={m} bare>
      <h1 className="vibe-heading font-black text-[36px] sm:text-[56px] leading-[0.98]">
        {m.title}
      </h1>
      {m.subtitle && (
        <p className="vibe-muted text-[16px] sm:text-[18px] mt-2 leading-snug">
          {m.subtitle}
        </p>
      )}
    </ModuleFrame>
  );
}

function Tags({ m, spaceId, moduleIndex, state, onChanged }: RProps<"tags">) {
  const adds = addsFor(state, moduleIndex);
  const allTags = [...m.tags, ...adds.map((a) => String(a.data.value || "")).filter(Boolean)];
  const [pending, setPending] = useState("");
  async function add() {
    const v = pending.trim();
    if (!v) return;
    setPending("");
    await postState(spaceId, moduleIndex, "add", { value: v });
    onChanged();
  }
  return (
    <ModuleFrame module={m}>
      <div className="flex flex-wrap gap-1.5">
        {allTags.map((t, i) => (
          <span key={i} className="mono text-[10px] tracking-widest px-2.5 py-1 rounded-full" style={{ border: "1px solid var(--v-rule)" }}>
            {t.toUpperCase()}
          </span>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          className="vibe-input text-[12px]"
          placeholder="+ tag"
          value={pending}
          onChange={(e) => setPending(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          maxLength={40}
        />
        <button className="vibe-btn-ghost" onClick={add} disabled={!pending.trim()}>add</button>
      </div>
    </ModuleFrame>
  );
}

function Notes({ m, spaceId, moduleIndex, state, onChanged }: RProps<"notes">) {
  const last = latestEdit(state, moduleIndex);
  const initial = last && typeof last.data.text === "string" ? last.data.text : m.text;
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    await postState(spaceId, moduleIndex, "edit", { text: draft });
    setSaving(false);
    onChanged();
  }
  return (
    <ModuleFrame module={m}>
      <textarea
        rows={5}
        className="vibe-input text-[14px] leading-relaxed resize-y"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="…"
        maxLength={4000}
      />
      <div className="mt-2 flex items-center justify-end gap-2">
        <span className="mono text-[9px] vibe-muted tabular-nums">{draft.length}/4000</span>
        <button className="vibe-btn" onClick={save} disabled={saving || draft === initial}>
          {saving ? "…" : "save"}
        </button>
      </div>
    </ModuleFrame>
  );
}

function OpenQuestion({ m, spaceId, moduleIndex, state, onChanged }: RProps<"open_question">) {
  const voices = voicesFor(state, moduleIndex);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit() {
    if (!text.trim()) return;
    setBusy(true);
    const ok = await postState(spaceId, moduleIndex, "voice", { text: text.trim() });
    setBusy(false);
    if (ok) { setText(""); onChanged(); }
  }
  return (
    <ModuleFrame module={m}>
      <p className="vibe-heading text-[18px] leading-snug">{m.prompt}</p>
      {voices.length > 0 && (
        <ul className="mt-3 space-y-2">
          {voices.map((v) => (
            <li key={v.id} className="text-[14px] leading-relaxed">
              <div className="mono text-[9px] vibe-muted tracking-widest mb-0.5">@{v.actor.displayName || "anon"}</div>
              {String(v.data.text || "")}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex gap-2">
        <input
          className="vibe-input text-[13px]"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          placeholder="…"
          maxLength={800}
        />
        <button className="vibe-btn" onClick={submit} disabled={busy || !text.trim()}>send</button>
      </div>
    </ModuleFrame>
  );
}

function Poll({ m, spaceId, moduleIndex, state, onChanged }: RProps<"poll">) {
  const counts = voteCounts(state, moduleIndex);
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const mine = myVote(state, moduleIndex, getAnonToken());
  async function vote(option: string) {
    await postState(spaceId, moduleIndex, "vote", { option });
    onChanged();
  }
  return (
    <ModuleFrame module={m}>
      <p className="vibe-heading text-[16px] mb-3">{m.question}</p>
      <ul className="space-y-1.5">
        {m.options.map((opt) => {
          const n = counts[opt] || 0;
          const pct = total > 0 ? Math.round((n / total) * 100) : 0;
          const picked = mine === opt;
          return (
            <li key={opt}>
              <button
                onClick={() => vote(opt)}
                className="w-full text-left relative overflow-hidden vibe-card p-2.5 transition-colors"
                style={{ borderColor: picked ? "var(--v-accent)" : "var(--v-rule)" }}
              >
                <div className="absolute inset-y-0 left-0 opacity-15" style={{ width: `${pct}%`, background: "var(--v-accent)" }} aria-hidden />
                <div className="relative flex justify-between gap-3 items-center">
                  <span className="text-[13px]">{opt}</span>
                  <span className="mono text-[10px] tabular-nums vibe-muted">{n}</span>
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mono text-[9px] vibe-muted mt-2">{total} {total === 1 ? "vote" : "votes"}</p>
    </ModuleFrame>
  );
}

function Checklist({ m, spaceId, moduleIndex, state, onChanged }: RProps<"checklist">) {
  const checks = checksFor(state, moduleIndex);
  const adds = addsFor(state, moduleIndex);
  const items = [...m.items.map((it) => it.text), ...adds.map((a) => String(a.data.value || "")).filter(Boolean)];
  const [pending, setPending] = useState("");
  const me = getAnonToken();
  async function toggle(i: number, currentlyChecked: boolean) {
    await postState(spaceId, moduleIndex, "check", { itemIndex: i, checked: !currentlyChecked });
    onChanged();
  }
  async function add() {
    const v = pending.trim();
    if (!v) return;
    setPending("");
    await postState(spaceId, moduleIndex, "add", { value: v });
    onChanged();
  }
  return (
    <ModuleFrame module={m}>
      <ul className="space-y-1.5">
        {items.map((t, i) => {
          const my = (checks.get(i) || []).some((e) => e.actor.id === me);
          const anyBody = (checks.get(i) || []).length > 0;
          return (
            <li key={i} className="flex items-center gap-3">
              <button
                onClick={() => toggle(i, my)}
                aria-label="toggle"
                className="w-5 h-5 rounded-sm flex items-center justify-center shrink-0"
                style={{ border: `1px solid ${my ? "var(--v-accent)" : "var(--v-rule)"}`, background: my ? "var(--v-accent)" : "transparent" }}
              >
                {my && <span className="text-white text-[11px] leading-none">✓</span>}
              </button>
              <span className="text-[14px] flex-1" style={{ textDecoration: anyBody ? "line-through" : "none", opacity: anyBody ? 0.6 : 1 }}>{t}</span>
            </li>
          );
        })}
      </ul>
      <div className="mt-3 flex gap-2">
        <input
          className="vibe-input text-[12px]"
          placeholder="+ item"
          value={pending}
          onChange={(e) => setPending(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          maxLength={200}
        />
        <button className="vibe-btn-ghost" onClick={add} disabled={!pending.trim()}>add</button>
      </div>
    </ModuleFrame>
  );
}

function HelpSlots({ m, spaceId, moduleIndex, state, onChanged }: RProps<"help_slots">) {
  const claims = claimsFor(state, moduleIndex);
  const me = getAnonToken();
  async function claim(slotLabel: string) {
    const ok = await postState(spaceId, moduleIndex, "claim", { slotLabel });
    if (ok) onChanged();
  }
  return (
    <ModuleFrame module={m}>
      <ul className="space-y-1.5">
        {m.slots.map((s) => {
          const c = claims.get(s.label);
          const mine = c && c.actor.id === me;
          return (
            <li key={s.label} className="vibe-card p-2.5 flex items-center gap-3">
              <span className="text-[13px] flex-1">{s.label}</span>
              {c ? (
                <span className="mono text-[10px] vibe-muted tracking-widest">{mine ? "you" : "@" + (c.actor.displayName || "anon")}</span>
              ) : (
                <button className="vibe-btn-ghost" onClick={() => claim(s.label)}>I'll take it</button>
              )}
            </li>
          );
        })}
      </ul>
    </ModuleFrame>
  );
}

function Stages({ m, spaceId, moduleIndex, state, onChanged }: RProps<"stages">) {
  const last = latestEdit(state, moduleIndex);
  const current = last && typeof last.data.current === "number" ? last.data.current : m.current;
  async function move(idx: number) {
    await postState(spaceId, moduleIndex, "edit", { current: idx });
    onChanged();
  }
  return (
    <ModuleFrame module={m}>
      <ol className="space-y-1.5">
        {m.stages.map((s, i) => (
          <li key={i}>
            <button
              onClick={() => move(i)}
              className="w-full text-left vibe-card p-2.5 flex items-center gap-3"
              style={{ borderColor: i === current ? "var(--v-accent)" : "var(--v-rule)" }}
            >
              <span className="mono text-[10px] vibe-muted tabular-nums w-5">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-[13px] flex-1">{s}</span>
              {i === current && <span className="mono text-[9px] vibe-accent tracking-widest">NOW</span>}
            </button>
          </li>
        ))}
      </ol>
    </ModuleFrame>
  );
}

function NumberBlock({ m }: RProps<"number_block">) {
  return (
    <ModuleFrame module={m}>
      <div className="vibe-heading font-black text-[64px] sm:text-[88px] leading-none">{m.value}</div>
      {m.caption && <div className="mono text-[11px] vibe-muted tracking-widest mt-2 uppercase">{m.caption}</div>}
    </ModuleFrame>
  );
}

/* ============================================================
   Tier B — data-source backed
   ============================================================ */

function IconRender({ m }: RProps<"icon">) {
  return (
    <ModuleFrame module={m}>
      <div className="flex items-center justify-center py-4">
        <Icon icon={m.iconify} width={m.size || 64} height={m.size || 64} />
      </div>
    </ModuleFrame>
  );
}

const OPEN_PROPS_HUES: Record<string, string[]> = {
  red:    ["#fff5f5","#ffe3e3","#ffc9c9","#ffa8a8","#ff8787","#ff6b6b","#fa5252","#f03e3e","#e03131","#c92a2a","#a51111","#7e0303"],
  pink:   ["#fff0f6","#ffdeeb","#fcc2d7","#faa2c1","#f783ac","#f06595","#e64980","#d6336c","#c2255c","#a61e4d","#862e51","#690442"],
  purple: ["#f8f0fc","#f3d9fa","#eebefa","#e599f7","#da77f2","#cc5de8","#be4bdb","#ae3ec9","#9c36b5","#862e9c","#6e1b8a","#590672"],
  violet: ["#f3f0ff","#e5dbff","#d0bfff","#b197fc","#9775fa","#845ef7","#7950f2","#7048e8","#6741d9","#5f3dc4","#492ea7","#3c2989"],
  indigo: ["#edf2ff","#dbe4ff","#bac8ff","#91a7ff","#748ffc","#5c7cfa","#4c6ef5","#4263eb","#3b5bdb","#364fc7","#2a3a89","#202f58"],
  blue:   ["#e7f5ff","#d0ebff","#a5d8ff","#74c0fc","#4dabf7","#339af0","#228be6","#1c7ed6","#1971c2","#1864ab","#175582","#10395c"],
  cyan:   ["#e3fafc","#c5f6fa","#99e9f2","#66d9e8","#3bc9db","#22b8cf","#15aabf","#1098ad","#0c8599","#0b7285","#055160","#053640"],
  teal:   ["#e6fcf5","#c3fae8","#96f2d7","#63e6be","#38d9a9","#20c997","#12b886","#0ca678","#099268","#087f5b","#066649","#054032"],
  green:  ["#ebfbee","#d3f9d8","#b2f2bb","#8ce99a","#69db7c","#51cf66","#40c057","#37b24d","#2f9e44","#2b8a3e","#1d6f33","#13511f"],
  lime:   ["#f4fce3","#e9fac8","#d8f5a2","#c0eb75","#a9e34b","#94d82d","#82c91e","#74b816","#66a80f","#5c940d","#3c6802","#274200"],
  yellow: ["#fff9db","#fff3bf","#ffec99","#ffe066","#ffd43b","#fcc419","#fab005","#f59f00","#f08c00","#e67700","#8a3814","#3f1610"],
  orange: ["#fff4e6","#ffe8cc","#ffd8a8","#ffc078","#ffa94d","#ff922b","#fd7e14","#f76707","#e8590c","#d9480f","#a82d00","#7b2300"],
  amber:  ["#fff4e6","#ffe8cc","#ffd8a8","#ffc078","#ffa94d","#ff922b","#fd7e14","#f76707","#e8590c","#d9480f","#a82d00","#7b2300"],
  gray:   ["#f8f9fa","#f1f3f5","#e9ecef","#dee2e6","#ced4da","#adb5bd","#868e96","#495057","#343a40","#212529","#101113","#000000"],
  slate:  ["#f8f9fa","#f1f3f5","#e9ecef","#dee2e6","#ced4da","#adb5bd","#868e96","#495057","#343a40","#212529","#101113","#000000"],
  zinc:   ["#f8f9fa","#f1f3f5","#e9ecef","#dee2e6","#ced4da","#adb5bd","#868e96","#495057","#343a40","#212529","#101113","#000000"],
  stone:  ["#f5f3ef","#e7e2d8","#d0c8b8","#b8ad96","#a09276","#8a7c5e","#71684c","#5a5240","#433c30","#2b2620","#15110d","#000000"],
};

function Palette({ m }: RProps<"palette">) {
  const hex = OPEN_PROPS_HUES[m.hue.toLowerCase()] || OPEN_PROPS_HUES.gray;
  const steps = m.steps && m.steps.length > 0 ? m.steps : [1, 3, 5, 7, 9, 11];
  return (
    <ModuleFrame module={m}>
      <div className="flex gap-1.5">
        {steps.map((s) => {
          const idx = Math.max(0, Math.min(hex.length - 1, s));
          return (
            <div key={s} className="flex-1 flex flex-col gap-1">
              <div className="aspect-square rounded-md" style={{ background: hex[idx] }} />
              <span className="mono text-[9px] vibe-muted tabular-nums text-center">{s}</span>
            </div>
          );
        })}
      </div>
    </ModuleFrame>
  );
}

function MapRender({ m }: RProps<"map">) {
  const [lng, lat] = m.center;
  // Simple static-OSM embed via tile-based iframe alternative: we use
  // the OpenStreetMap "export" embed iframe for v3.0. Replace with
  // Leaflet later for interactivity.
  const bbox = bboxFromCenter(lng, lat, m.zoom);
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik${m.markers?.[0] ? `&marker=${m.markers[0].lat},${m.markers[0].lng}` : ""}`;
  return (
    <ModuleFrame module={m}>
      <div className="aspect-[16/10] rounded-md overflow-hidden" style={{ border: "1px solid var(--v-rule)" }}>
        <iframe
          src={src}
          className="w-full h-full"
          style={{ border: 0 }}
          loading="lazy"
        />
      </div>
      <p className="mono text-[10px] vibe-muted mt-2">{lat.toFixed(3)}, {lng.toFixed(3)}</p>
    </ModuleFrame>
  );
}

function bboxFromCenter(lng: number, lat: number, zoom: number): string {
  // Rough degree-span per zoom; not surveying-grade, just for embed framing.
  const span = 360 / Math.pow(2, zoom);
  const minLng = lng - span / 2;
  const maxLng = lng + span / 2;
  const minLat = lat - span / 4;
  const maxLat = lat + span / 4;
  return `${minLng},${minLat},${maxLng},${maxLat}`;
}

function TimeRender({ m }: RProps<"time">) {
  if (m.mode === "countdown" && m.date) {
    return (
      <ModuleFrame module={m}>
        <CountdownDisplay iso={m.date} />
      </ModuleFrame>
    );
  }
  if (m.mode === "timeline" && m.entries && m.entries.length > 0) {
    return (
      <ModuleFrame module={m}>
        <ol className="space-y-1.5">
          {m.entries.map((e, i) => (
            <li key={i} className="flex gap-3 items-baseline">
              <span className="mono text-[10px] vibe-muted tabular-nums w-24 shrink-0">{e.date}</span>
              <span className="text-[13px]">{e.label}</span>
            </li>
          ))}
        </ol>
      </ModuleFrame>
    );
  }
  // date mode
  return (
    <ModuleFrame module={m}>
      <div className="vibe-heading font-black text-[32px] sm:text-[40px] leading-none">
        {m.date || "—"}
      </div>
      {m.timezone && <div className="mono text-[10px] vibe-muted mt-1">{m.timezone}</div>}
    </ModuleFrame>
  );
}

function CountdownDisplay({ iso }: { iso: string }) {
  const [, force] = useState(0);
  // Re-render every minute so the countdown ticks.
  useTick(60_000, () => force((n) => n + 1));
  const target = Date.parse(iso);
  if (!Number.isFinite(target)) return <div className="vibe-muted text-[14px]">—</div>;
  const diff = target - Date.now();
  const past = diff < 0;
  const abs = Math.abs(diff);
  const days = Math.floor(abs / 86_400_000);
  const hours = Math.floor((abs % 86_400_000) / 3_600_000);
  return (
    <div>
      <div className="vibe-heading font-black text-[44px] sm:text-[56px] leading-none tabular-nums">
        {past ? "+" : ""}{days}<span className="text-[20px] vibe-muted">d</span>
        <span className="text-[20px] vibe-muted ml-2">{hours}h</span>
      </div>
      <div className="mono text-[10px] vibe-muted mt-2">
        {past ? "since" : "until"} {new Date(target).toISOString().slice(0, 10)}
      </div>
    </div>
  );
}

import { useEffect } from "react";
function useTick(ms: number, cb: () => void) {
  useEffect(() => {
    const id = window.setInterval(cb, ms);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

function Knowledge({ m }: RProps<"knowledge">) {
  type Wiki = { title: string; extract: string; thumbnail?: { source: string }; content_urls?: { desktop?: { page: string } } };
  const [data, setData] = useState<Wiki | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let alive = true;
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(m.topic)}`;
    fetch(url)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((j) => { if (alive) setData(j as Wiki); })
      .catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [m.topic]);
  return (
    <ModuleFrame module={m}>
      {error && <p className="mono text-[10px] vibe-muted">topic not found</p>}
      {!error && !data && <p className="mono text-[10px] vibe-muted">loading…</p>}
      {data && (
        <div className="flex gap-4">
          {m.show.includes("thumb") && data.thumbnail && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={data.thumbnail.source} alt={data.title} className="w-24 h-24 object-cover rounded-md shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <h3 className="vibe-heading font-bold text-[16px] mb-1">{data.title}</h3>
            {m.show.includes("summary") && (
              <p className="text-[13px] leading-relaxed vibe-muted line-clamp-5">{data.extract}</p>
            )}
            {data.content_urls?.desktop?.page && (
              <a href={data.content_urls.desktop.page} target="_blank" rel="noreferrer noopener" className="mono text-[10px] tracking-widest vibe-accent underline mt-2 inline-block">
                read on wikipedia ↗
              </a>
            )}
          </div>
        </div>
      )}
    </ModuleFrame>
  );
}

/* ============================================================
   Tier C — framework
   ============================================================ */

const FRAMEWORK_SLOTS: Record<string, { slot: string; placeholder: string }[]> = {
  okr:        [{ slot: "objective", placeholder: "Objective" }, { slot: "kr1", placeholder: "Key Result 1" }, { slot: "kr2", placeholder: "Key Result 2" }, { slot: "kr3", placeholder: "Key Result 3" }],
  scqa:       [{ slot: "situation", placeholder: "Situation" }, { slot: "complication", placeholder: "Complication" }, { slot: "question", placeholder: "Question" }, { slot: "answer", placeholder: "Answer" }],
  eisenhower: [{ slot: "urgent_important", placeholder: "Urgent + important" }, { slot: "important", placeholder: "Important, not urgent" }, { slot: "urgent", placeholder: "Urgent, not important" }, { slot: "neither", placeholder: "Neither" }],
  rice:       [{ slot: "reach", placeholder: "Reach" }, { slot: "impact", placeholder: "Impact" }, { slot: "confidence", placeholder: "Confidence" }, { slot: "effort", placeholder: "Effort" }],
  kanban:     [{ slot: "todo", placeholder: "To do" }, { slot: "doing", placeholder: "Doing" }, { slot: "done", placeholder: "Done" }],
  adr:        [{ slot: "context", placeholder: "Context" }, { slot: "decision", placeholder: "Decision" }, { slot: "consequences", placeholder: "Consequences" }],
  rfc:        [{ slot: "summary", placeholder: "Summary" }, { slot: "motivation", placeholder: "Motivation" }, { slot: "design", placeholder: "Design" }],
  postmortem: [{ slot: "impact", placeholder: "Impact" }, { slot: "root_cause", placeholder: "Root cause" }, { slot: "lessons", placeholder: "Lessons" }],
  faq:        [{ slot: "q1", placeholder: "Question" }, { slot: "a1", placeholder: "Answer" }, { slot: "q2", placeholder: "Question" }, { slot: "a2", placeholder: "Answer" }],
  one_pager:  [{ slot: "problem", placeholder: "Problem" }, { slot: "proposal", placeholder: "Proposal" }, { slot: "success", placeholder: "Success" }],
};

function Framework({ m, spaceId, moduleIndex, state, onChanged }: RProps<"framework">) {
  const last = latestEdit(state, moduleIndex);
  const lastValues = (last && typeof last.data.text === "string")
    ? safeParseObject(last.data.text)
    : null;
  const slots = FRAMEWORK_SLOTS[m.kind] || [];
  const current = { ...m.prefill, ...(lastValues || {}) };
  const [values, setValues] = useState<Record<string, string>>(current);
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    await postState(spaceId, moduleIndex, "edit", { text: JSON.stringify(values) });
    setSaving(false);
    onChanged();
  }
  return (
    <ModuleFrame module={m}>
      <div className="mono text-[10px] vibe-muted tracking-widest uppercase mb-3">{m.kind.replace("_", " ")}</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {slots.map((s) => (
          <div key={s.slot} className="space-y-1">
            <label className="mono text-[10px] vibe-muted tracking-widest uppercase">{s.placeholder}</label>
            <textarea
              rows={2}
              className="vibe-input text-[13px] resize-y"
              value={values[s.slot] || ""}
              onChange={(e) => setValues({ ...values, [s.slot]: e.target.value })}
              maxLength={800}
            />
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end">
        <button className="vibe-btn" onClick={save} disabled={saving}>save</button>
      </div>
    </ModuleFrame>
  );
}

function safeParseObject(s: string): Record<string, string> | null {
  try {
    const v = JSON.parse(s);
    if (v && typeof v === "object" && !Array.isArray(v)) {
      const out: Record<string, string> = {};
      for (const [k, val] of Object.entries(v)) {
        if (typeof val === "string") out[k] = val;
      }
      return out;
    }
  } catch { /* */ }
  return null;
}

/* ============================================================
   Optional / rare
   ============================================================ */

function Typography({ m }: RProps<"typography">) {
  // Best-effort: trust the AI's font name; Google Fonts CSS API will
  // 404 gracefully if it's unknown.
  const headingUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(m.heading)}:wght@700&display=swap`;
  const bodyUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(m.body)}:wght@400&display=swap`;
  return (
    <ModuleFrame module={m}>
      <link rel="stylesheet" href={headingUrl} />
      <link rel="stylesheet" href={bodyUrl} />
      <div style={{ fontFamily: m.heading, fontWeight: 700, fontSize: "28px", lineHeight: 1.1 }}>
        {m.heading}
      </div>
      <div style={{ fontFamily: m.body, fontSize: "14px", marginTop: "6px", lineHeight: 1.6 }}>
        The quick brown fox jumps over the lazy dog — {m.body}
      </div>
    </ModuleFrame>
  );
}

function Formula({ m }: RProps<"formula">) {
  // Render via KaTeX auto-renderer at view time. Keep it lazy and small.
  const ref = useFormulaRender(m.latex, m.display === "block");
  return (
    <ModuleFrame module={m}>
      <div ref={ref} className="text-[16px]" />
    </ModuleFrame>
  );
}

function useFormulaRender(latex: string, block: boolean) {
  const ref = useState<{ current: HTMLDivElement | null }>({ current: null })[0];
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // dynamic import keeps katex out of the initial bundle
        const katex = (await import("katex")).default;
        // Stylesheet pulled from CDN to avoid bundler CSS-as-module config.
        if (!document.head.querySelector('link[data-katex]')) {
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.dataset.katex = "1";
          link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css";
          document.head.appendChild(link);
        }
        if (cancelled || !ref.current) return;
        ref.current.innerHTML = katex.renderToString(latex, { throwOnError: false, displayMode: block });
      } catch { /* */ }
    })();
    return () => { cancelled = true; };
  }, [latex, block, ref]);
  return (el: HTMLDivElement | null) => { ref.current = el; };
}

function Chart({ m }: RProps<"chart">) {
  // v3.0: simple inline bars — Observable Plot later. Lets us ship.
  const max = Math.max(...m.data.map((d) => d.y), 1);
  return (
    <ModuleFrame module={m}>
      <ul className="space-y-1.5">
        {m.data.map((d, i) => (
          <li key={i} className="flex items-center gap-3">
            <span className="mono text-[10px] vibe-muted w-20 shrink-0 truncate">{d.x}</span>
            <div className="flex-1 h-4 rounded-sm relative overflow-hidden" style={{ background: "var(--v-rule)" }}>
              <div className="absolute inset-y-0 left-0" style={{ width: `${(d.y / max) * 100}%`, background: "var(--v-accent)" }} />
            </div>
            <span className="mono text-[10px] tabular-nums w-12 text-right">{d.y}</span>
          </li>
        ))}
      </ul>
      {(m.xLabel || m.yLabel) && (
        <p className="mono text-[9px] vibe-muted mt-3">{m.xLabel ? `x: ${m.xLabel}` : ""} {m.yLabel ? `· y: ${m.yLabel}` : ""}</p>
      )}
    </ModuleFrame>
  );
}

function ImageMod({ m }: RProps<"image">) {
  return (
    <ModuleFrame module={m}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={m.url} alt={m.alt || ""} className="w-full rounded-md" />
    </ModuleFrame>
  );
}

/* ============================================================
   Types
   ============================================================ */

type RProps<T extends Module["type"]> = {
  m: Extract<Module, { type: T }>;
  spaceId: string;
  moduleIndex: number;
  state: ModuleStateEntry[];
  onChanged: () => void;
};
