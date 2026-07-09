import { randomBytes } from "node:crypto";

/** ≥16-char anon token (owner / actor). */
export function anonToken(): string {
  return randomBytes(24).toString("base64url");
}

type Json = Record<string, unknown> & { space?: Record<string, unknown> };

export function makeApi(baseURL: string) {
  return async (method: string, path: string, body?: unknown) => {
    const res = await fetch(`${baseURL}${path}`, {
      method,
      headers: { "content-type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = (await res.json().catch(() => null)) as Json | null;
    return { status: res.status, ok: res.ok, json };
  };
}

export interface Draft {
  id: string;
  ownerToken: string;
  ownerKey: string;
  moodboardIndex: number;
  partsIndex: number;
}

/**
 * Create an isolated anonymous draft with a moodboard (1 image) and a
 * parts_list (1 entry), seeded straight through the public API. Returns the
 * localStorage owner-token key so a test can authorise editing at /s/[id]
 * without a Clerk login.
 */
export async function createSeededDraft(baseURL: string): Promise<Draft> {
  const api = makeApi(baseURL);
  const ownerToken = anonToken();
  const created = await api("POST", "/api/spaces", {
    input: "Hochzeitsshooting in Berlin, ganztags, zwei Fotografen, Moodboard und Materialliste. (E2E-Test, löschbar.)",
    language: "de",
    anonToken: ownerToken,
  });
  const id = created.json?.id as string | undefined;
  if (!id) throw new Error(`create failed: ${created.status} ${JSON.stringify(created.json)}`);

  const snap = async () => {
    const r = await api("GET", `/api/spaces/${id}`);
    return r.json?.space as { modules: { type: string }[]; modulesRev: number };
  };
  let sp = await snap();
  for (const type of ["moodboard", "parts_list"]) {
    await api("POST", `/api/spaces/${id}/widgets`, { widget: { type }, modulesRev: sp.modulesRev, anonOwnerToken: ownerToken });
    sp = await snap();
  }
  const moodboardIndex = sp.modules.findIndex((m) => m.type === "moodboard");
  const partsIndex = sp.modules.findIndex((m) => m.type === "parts_list");
  // Seed content so a lost association is visible: a moodboard image + a parts row.
  await api("POST", `/api/spaces/${id}/state`, {
    moduleIndex: moodboardIndex, kind: "upload",
    data: { url: "https://picsum.photos/seed/e2e-mb/320/200", name: "ref.jpg", mimeType: "image/jpeg" },
    anonToken: ownerToken,
  });
  await api("POST", `/api/spaces/${id}/state`, {
    moduleIndex: partsIndex, kind: "add", data: { name: "SONY A7 (E2E)" }, anonToken: ownerToken,
  });

  return { id, ownerToken, ownerKey: `magyc.space_owner.${id}`, moodboardIndex, partsIndex };
}

/** Server-side invariant check (subset of scripts/concurrency-harness.mjs). */
export async function checkInvariants(baseURL: string, id: string): Promise<string[]> {
  const api = makeApi(baseURL);
  const sp = (await api("GET", `/api/spaces/${id}`)).json?.space as {
    modules: { id?: string }[]; state: { moduleId?: string | null }[]; modulesRev: number;
  };
  const v: string[] = [];
  const ids = sp.modules.map((m) => m.id);
  if (ids.some((x) => typeof x !== "string" || !x)) v.push("module without id");
  if (new Set(ids).size !== ids.length) v.push("duplicate module ids");
  const idSet = new Set(ids);
  const orphans = sp.state.filter((e) => e.moduleId && !idSet.has(e.moduleId));
  if (orphans.length) v.push(`${orphans.length} orphan state rows`);
  if (!Number.isInteger(sp.modulesRev) || sp.modulesRev < 0) v.push(`bad modulesRev ${sp.modulesRev}`);
  return v;
}
