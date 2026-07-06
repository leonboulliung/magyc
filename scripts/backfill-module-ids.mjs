#!/usr/bin/env node
//
// One-time backfill for migration 019 (stable module ids).
//
//   1. Assign a permanent `id` to every module in spaces.modules that lacks
//      one, and persist it.
//   2. Set module_state.module_id for every row whose module_id is still null,
//      using the id of the module currently at its module_index.
//
// Idempotent: modules that already have ids and rows that already have a
// module_id are left untouched, so it is safe to re-run. Pass --dry to print
// what would change without writing.
//
//   node scripts/backfill-module-ids.mjs [--dry]

import { readFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";

const DRY = process.argv.includes("--dry");

// Matches lib/id.ts — a short, URL-safe, unambiguous id.
const ALPHABET = "23456789abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
function newId() {
  const bytes = randomBytes(10);
  let out = "";
  for (let i = 0; i < 10; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

async function loadLocalEnv() {
  try {
    const text = await readFile(".env.local", "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const i = trimmed.indexOf("=");
      const key = trimmed.slice(0, i).trim();
      let value = trimmed.slice(i + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // env may be passed directly in CI/prod.
  }
}

await loadLocalEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}
const base = `${url.replace(/\/$/, "")}/rest/v1`;
const headers = {
  apikey: serviceKey,
  authorization: `Bearer ${serviceKey}`,
  "content-type": "application/json",
};

async function api(path, init = {}) {
  const res = await fetch(`${base}${path}`, { ...init, headers: { ...headers, ...(init.headers || {}) } });
  if (!res.ok) throw new Error(`${init.method || "GET"} ${path} → ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

let spacesScanned = 0;
let modulesIded = 0;
let spacesPatched = 0;
let rowsPatched = 0;

const PAGE = 500;
for (let offset = 0; ; offset += PAGE) {
  const spaces = await api(`/spaces?select=id,modules&order=created_at.asc&limit=${PAGE}&offset=${offset}`);
  if (!spaces || spaces.length === 0) break;

  for (const space of spaces) {
    spacesScanned++;
    const modules = Array.isArray(space.modules) ? space.modules : [];
    if (modules.length === 0) continue;

    // 1. Assign ids to any module lacking one.
    let changed = false;
    for (const m of modules) {
      if (m && typeof m === "object" && typeof m.id !== "string") {
        m.id = newId();
        modulesIded++;
        changed = true;
      }
    }
    if (changed) {
      spacesPatched++;
      if (!DRY) {
        await api(`/spaces?id=eq.${encodeURIComponent(space.id)}`, {
          method: "PATCH",
          headers: { prefer: "return=minimal" },
          body: JSON.stringify({ modules }),
        });
      }
    }

    // 2. Set module_id on state rows still missing it, per module_index.
    for (let k = 0; k < modules.length; k++) {
      const id = modules[k] && typeof modules[k].id === "string" ? modules[k].id : null;
      if (!id) continue;
      if (DRY) continue;
      // Returning representation lets us count how many rows were touched.
      const updated = await api(
        `/module_state?space_id=eq.${encodeURIComponent(space.id)}&module_index=eq.${k}&module_id=is.null&select=id`,
        { method: "PATCH", headers: { prefer: "return=representation" }, body: JSON.stringify({ module_id: id }) },
      );
      rowsPatched += Array.isArray(updated) ? updated.length : 0;
    }
  }

  if (spaces.length < PAGE) break;
}

console.log(
  `${DRY ? "[dry-run] " : ""}spaces scanned: ${spacesScanned}, spaces re-saved: ${spacesPatched}, ` +
  `modules given an id: ${modulesIded}, state rows linked: ${rowsPatched}`,
);
