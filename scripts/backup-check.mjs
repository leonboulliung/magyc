#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

async function loadLocalEnv() {
  try {
    const text = await readFile(".env.local", "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
      const index = trimmed.indexOf("=");
      const key = trimmed.slice(0, index).trim();
      let value = trimmed.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (key && process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // CI/production checks should pass env vars directly; local .env is optional.
  }
}

await loadLocalEnv();

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const headers = {
  apikey: serviceKey,
  authorization: `Bearer ${serviceKey}`,
};

function parseCount(contentRange) {
  if (!contentRange || !contentRange.includes("/")) return null;
  const raw = contentRange.split("/").pop();
  if (!raw || raw === "*") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

async function countTable(table) {
  const res = await fetch(`${url}/rest/v1/${table}?select=id`, {
    headers: {
      ...headers,
      prefer: "count=exact",
      range: "0-0",
    },
  });
  const body = res.ok ? null : await res.text().catch(() => "");
  return {
    table,
    ok: res.ok,
    status: res.status,
    count: parseCount(res.headers.get("content-range")),
    error: res.ok ? null : body.slice(0, 500),
  };
}

async function checkStorageBucket(bucket) {
  const res = await fetch(`${url}/storage/v1/bucket/${bucket}`, { headers });
  const body = await res.text().catch(() => "");
  let parsed = null;
  try {
    parsed = body ? JSON.parse(body) : null;
  } catch {
    parsed = body.slice(0, 500);
  }
  return {
    bucket,
    ok: res.ok,
    status: res.status,
    public: parsed && typeof parsed === "object" ? parsed.public ?? null : null,
    error: res.ok ? null : typeof parsed === "string" ? parsed : parsed?.message ?? body.slice(0, 500),
  };
}

const tables = [
  "profiles",
  "spaces",
  "module_state",
  "space_versions",
  "studio_presets",
  "project_contracts",
  "project_members",
  "project_invitations",
  "support_tickets",
  "admin_audit_events",
  "project_messages",
  "ai_events",
  "app_events",
  "rate_limits",
  "ops_migration_log",
];

const report = {
  generatedAt: new Date().toISOString(),
  projectUrl: url.replace(/^https?:\/\//, ""),
  tables: [],
  storage: [],
  notes: [
    "This is a non-destructive operations check, not a database dump.",
    "Use Supabase point-in-time recovery or pg_dump for real restore drills.",
  ],
};

for (const table of tables) {
  report.tables.push(await countTable(table));
}
report.storage.push(await checkStorageBucket("space_assets"));

await mkdir("backups", { recursive: true });
const fileName = `backup-check-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
const path = join("backups", fileName);
await writeFile(path, `${JSON.stringify(report, null, 2)}\n`);

const failed = [
  ...report.tables.filter((row) => !row.ok),
  ...report.storage.filter((row) => !row.ok),
];
const requiredTables = new Set([
  "profiles",
  "spaces",
  "module_state",
  "studio_presets",
  "project_contracts",
  "project_members",
  "project_invitations",
]);
const requiredFailures = failed.filter((row) => (
  "table" in row
    ? requiredTables.has(row.table) || row.status === 401 || row.status === 403
    : row.bucket === "space_assets" || row.status === 401 || row.status === 403
));

console.log(`Wrote ${path}`);
console.table(report.tables.map(({ table, ok, status, count }) => ({ table, ok, status, count })));
console.table(report.storage.map(({ bucket, ok, status, public: isPublic }) => ({ bucket, ok, status, public: isPublic })));

if (failed.length > 0) {
  console.warn(`${failed.length} checks failed. This can be expected before newer migrations are applied.`);
}
if (requiredFailures.length > 0) {
  console.error("Required backup checks failed. Verify production Supabase env vars before trusting backups/restores.");
  process.exit(1);
}
