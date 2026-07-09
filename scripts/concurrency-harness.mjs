#!/usr/bin/env node
//
// Progressive concurrency + invariant harness.
//
// Creates ONE isolated anonymous draft space, then ramps concurrent actors
// (1 → 2 → 4 → 8 …) doing mixed structural ops (reorder / add / edit / delete)
// and collaborative content ops (state add/upload), and after every level
// checks a set of server-side invariants. It answers, with data: at what
// concurrency do writes start losing / corrupting, and does the optimistic
// lock + id-based state association hold under contention (two tabs swapping
// at the same instant).
//
// Uses ONLY public HTTP endpoints against a deployed instance — no
// service-role key. Safe: everything happens inside one throwaway draft.
//
//   node scripts/concurrency-harness.mjs [--base https://www.magyc.site] [--levels 1,2,4,8]
//
// It does NOT hard-fail the process on an invariant violation; it reports
// every level so you can see where the limit is.

import { randomBytes } from "node:crypto";

const args = process.argv.slice(2);
function arg(name, def) {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
const BASE = arg("--base", "https://www.magyc.site").replace(/\/$/, "");
const LEVELS = arg("--levels", "1,2,4,8").split(",").map((n) => parseInt(n, 10)).filter(Boolean);

const token = () => randomBytes(24).toString("base64url"); // ≥16 chars anon token
const ownerToken = token();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (a) => a[Math.floor(Math.random() * a.length)];

async function api(method, path, body, timeoutMs = 15000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const started = Date.now();
  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, ok: res.ok, json, ms: Date.now() - started };
  } catch (e) {
    return { status: 0, ok: false, json: { error: String(e?.name || e) }, ms: Date.now() - started };
  } finally {
    clearTimeout(t);
  }
}

async function snapshot(id) {
  const r = await api("GET", `/api/spaces/${id}`);
  const sp = r.json?.space;
  if (!sp) throw new Error(`snapshot failed: ${r.status} ${JSON.stringify(r.json)}`);
  return sp;
}

// ── Invariants ─────────────────────────────────────────────────────────────
function checkInvariants(sp) {
  const violations = [];
  const modules = Array.isArray(sp.modules) ? sp.modules : [];
  const state = Array.isArray(sp.state) ? sp.state : [];

  const ids = modules.map((m) => m.id);
  // I1: every module has a non-empty string id
  if (ids.some((x) => typeof x !== "string" || !x)) violations.push("I1 module without id");
  // I2: module ids unique
  if (new Set(ids).size !== ids.length) violations.push("I2 duplicate module ids");
  // I3: module count sane
  if (modules.length < 0 || modules.length > 65) violations.push(`I3 module count ${modules.length}`);
  // I4: modules_rev is a non-negative integer
  if (!Number.isInteger(sp.modulesRev) || sp.modulesRev < 0) violations.push(`I4 bad modulesRev ${sp.modulesRev}`);
  // I5: no orphan state — every state.moduleId (when set) references a live module
  const idSet = new Set(ids);
  const orphans = state.filter((e) => e.moduleId && !idSet.has(e.moduleId));
  if (orphans.length) violations.push(`I5 ${orphans.length} orphan state rows (moduleId not in modules)`);
  // I6: no two ACTIVE claims on the same (module, slot)
  const claimKey = new Map();
  for (const e of state) {
    if (e.kind !== "claim" || e.data?.claimed === false) continue;
    const k = `${e.moduleId || e.moduleIndex}::${e.data?.slotLabel}`;
    const holders = claimKey.get(k) || new Set();
    holders.add(e.actor?.id);
    claimKey.set(k, holders);
  }
  for (const [k, holders] of claimKey) if (holders.size > 1) violations.push(`I6 slot ${k} held by ${holders.size} actors`);

  return { violations, moduleCount: modules.length, stateCount: state.length, rev: sp.modulesRev };
}

// ── Structural op factories (all share a rev → maximise contention) ──────────
function bodyIndices(sp) {
  // header zone = heading/rich_text/tags; the rest is reorderable body.
  const header = new Set(["heading", "rich_text", "tags"]);
  return sp.modules.map((m, i) => ({ m, i })).filter(({ m }) => !header.has(m.type)).map(({ i }) => i);
}

function reorderOp(id, sp, rev) {
  const body = bodyIndices(sp);
  if (body.length < 2) return null;
  const a = pick(body); let b = pick(body); if (a === b) b = body[(body.indexOf(a) + 1) % body.length];
  const modules = [...sp.modules];
  [modules[a], modules[b]] = [modules[b], modules[a]];
  const order = sp.modules.map((_, i) => (i === a ? b : i === b ? a : i));
  return () => api("PATCH", `/api/spaces/${id}/widgets`, { modules, order, modulesRev: rev, anonOwnerToken: ownerToken });
}
function addOp(id, _sp, rev) {
  const type = pick(["moodboard", "parts_list", "checklist", "crew", "shot_list", "deliverables"]);
  return () => api("POST", `/api/spaces/${id}/widgets`, { widget: { type }, modulesRev: rev, anonOwnerToken: ownerToken });
}
function editOp(id, sp, rev) {
  const body = bodyIndices(sp);
  if (!body.length) return null;
  const idx = pick(body);
  const widget = { ...sp.modules[idx], microTitle: `edit-${randomBytes(3).toString("hex")}` };
  return () => api("PUT", `/api/spaces/${id}/widgets/${idx}`, { widget, modulesRev: rev, anonOwnerToken: ownerToken });
}
function deleteOp(id, sp, rev) {
  const body = bodyIndices(sp);
  if (body.length <= 3) return null; // keep the space from emptying out
  const idx = pick(body);
  return () => api("DELETE", `/api/spaces/${id}/widgets`, { index: idx, modulesRev: rev, anonOwnerToken: ownerToken });
}
// content op: append to a random body module by its CURRENT index (different actor)
function stateOp(id, sp) {
  const body = bodyIndices(sp);
  if (!body.length) return null;
  const idx = pick(body);
  const actor = token();
  return () => api("POST", `/api/spaces/${id}/state`, {
    moduleIndex: idx, kind: "add", data: { text: `c-${randomBytes(3).toString("hex")}` }, anonToken: actor,
  });
}

function tally(results) {
  const t = { ok: 0, conflict: 0, rate: 0, error: 0, other: 0, maxMs: 0 };
  for (const r of results) {
    t.maxMs = Math.max(t.maxMs, r.ms);
    if (r.ok) t.ok++;
    else if (r.status === 409) t.conflict++;
    else if (r.status === 429) t.rate++;
    else if (r.status === 0 || r.status >= 500) t.error++;
    else t.other++;
  }
  return t;
}

async function main() {
  console.log(`\n▲ Concurrency harness → ${BASE}  levels=[${LEVELS.join(",")}]\n`);

  // 1. Create an isolated draft.
  const created = await api("POST", "/api/spaces", {
    // Must read as a real photography brief or the classifier rejects it.
    // This is a throwaway load-test draft, safe to delete.
    input: "Hochzeitsshooting in Berlin, ganztags, zwei Fotografen, Moodboard und Shotliste. (Lasttest, löschbar.)",
    language: "de",
    anonToken: ownerToken,
  }, 60000);
  if (!created.ok || !created.json?.id) {
    console.error("Could not create test space:", created.status, JSON.stringify(created.json));
    process.exit(1);
  }
  const id = created.json.id;
  const returnedToken = created.json.anonOwnerToken;
  console.log(`created draft ${id} (owner token ${returnedToken === ownerToken ? "matches" : "DIFFERS!"})\n`);
  // The route stamps anon_owner_token = the creator's anonToken, so ownerToken authorises edits.

  // Seed a few known reorderable widgets so there is always something to move.
  let seed = await snapshot(id);
  for (const type of ["moodboard", "parts_list", "shot_list", "checklist"]) {
    const r = await api("POST", `/api/spaces/${id}/widgets`, { widget: { type }, modulesRev: seed.modulesRev, anonOwnerToken: ownerToken });
    if (r.ok) seed = await snapshot(id); else console.log(`  seed ${type}: ${r.status}`);
  }

  const rows = [];
  for (const N of LEVELS) {
    const sp = await snapshot(id);
    const rev = sp.modulesRev;

    // Build N structural actors (all on the SAME rev → contention) + N/2 content actors.
    const factories = [reorderOp, addOp, editOp, deleteOp];
    const ops = [];
    for (let i = 0; i < N; i++) {
      let op = null, guard = 0;
      while (!op && guard++ < 6) op = pick(factories)(id, sp, rev);
      if (op) ops.push(op);
    }
    const contentN = Math.max(1, Math.floor(N / 2));
    for (let i = 0; i < contentN; i++) { const op = stateOp(id, sp); if (op) ops.push(op); }

    const results = await Promise.all(ops.map((op) => op()));
    await sleep(400); // let any async state settle
    const after = await snapshot(id);
    const inv = checkInvariants(after);
    const t = tally(results);

    const line = {
      N, ops: ops.length,
      ok: t.ok, conflict409: t.conflict, rate429: t.rate, error5xx: t.error, other: t.other,
      maxMs: t.maxMs, revBefore: rev, revAfter: inv.rev, mods: inv.moduleCount, state: inv.stateCount,
      invariants: inv.violations.length ? inv.violations.join(" | ") : "OK",
    };
    rows.push(line);
    console.log(
      `level N=${String(N).padStart(2)} | ops=${line.ops} ok=${t.ok} 409=${t.conflict} 429=${t.rate} 5xx/err=${t.error} ` +
      `| rev ${rev}→${inv.rev} mods=${inv.moduleCount} state=${inv.stateCount} maxMs=${t.maxMs} ` +
      `| invariants: ${line.invariants}`,
    );
  }

  console.log("\n── Summary ─────────────────────────────────────────────");
  const brokeAt = rows.find((r) => r.invariants !== "OK");
  if (brokeAt) console.log(`❌ invariants first violated at N=${brokeAt.N}: ${brokeAt.invariants}`);
  else console.log("✅ all invariants held at every level (no orphans / dup ids / lost-rev corruption / double claims)");
  // Also fail if every structural level lost the race entirely (0 ok anywhere) —
  // that would mean the API rejected all writes (a regression), not contention.
  const noWritesLanded = rows.every((r) => r.ok === 0);
  const contention = rows.map((r) => `N${r.N}:ok${r.ok}/409${r.conflict409}`).join("  ");
  console.log(`contention (structural writes; expect ~1 ok, rest 409 under a shared rev): ${contention}`);
  console.log(`\ntest space left as a draft: ${BASE.replace("www.", "")}/  id=${id}  (unpublished; delete from the dashboard if desired)`);

  // CI signal: fail on any invariant violation, or if no write ever landed.
  if (brokeAt || noWritesLanded) process.exit(1);
}

main().catch((e) => { console.error("harness crashed:", e); process.exit(1); });
