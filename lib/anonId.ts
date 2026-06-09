"use client";

import { newAnonToken } from "./id";
import { getActivePersona } from "./personas";

const KEY = "creator.anon_token";
const NAME_KEY = "creator.anon_name";

/** Get the browser's anonymous identity token. Created on first call.
 *  Stable across sessions until the user clears storage.
 *
 *  Persona override: if a test persona is active (selected via the
 *  switcher), that persona's stable token wins. Lets us simulate two
 *  collaborators on the same browser by toggling. */
export function getAnonToken(): string {
  if (typeof window === "undefined") return "";
  const persona = getActivePersona();
  if (persona) return persona.token;
  let t = window.localStorage.getItem(KEY);
  if (!t) {
    t = newAnonToken();
    window.localStorage.setItem(KEY, t);
  }
  return t;
}

/** Optional display name the anonymous user has chosen. May be empty.
 *  Personas override this when active — their display name is the
 *  attribution shown in collaborative state. */
export function getAnonDisplayName(): string {
  if (typeof window === "undefined") return "";
  const persona = getActivePersona();
  if (persona) return persona.displayName;
  return window.localStorage.getItem(NAME_KEY) || "";
}

export function setAnonDisplayName(name: string): void {
  if (typeof window === "undefined") return;
  const v = name.trim().slice(0, 40);
  if (v) window.localStorage.setItem(NAME_KEY, v);
  else window.localStorage.removeItem(NAME_KEY);
}

/** Per-space owner-token storage. The creator carries the owner token
 *  for their space; without it (e.g. cleared storage) they lose draft-
 *  level edit access until they publish. */
function spaceKey(spaceId: string): string {
  return `creator.space_owner.${spaceId}`;
}

export function rememberSpaceOwnerToken(spaceId: string, token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(spaceKey(spaceId), token);
}

export function getSpaceOwnerToken(spaceId: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(spaceKey(spaceId));
}
