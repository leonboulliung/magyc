import OpenAI from "openai";
import { sanitizeRoleLabels } from "./roleSanitize";

/**
 * Shared "suggest role labels" plumbing. Used by:
 *  - /api/cards/suggest-roles-draft (creator at create time, no card yet)
 *  - /api/cards/[id]/suggest-roles   (owner editing an existing card)
 *
 * The model proposes 3-6 SHORT, GENERIC role labels someone could claim
 * to help this thing happen. It abstracts roles from the brief — it
 * never invents specifics (no names, no real titles, no @handles).
 * Returns an empty array when nothing fits.
 */

const SYSTEM_PROMPT = `You suggest predefined role labels for a "thing"
(a plan) on a city-layer app. The creator has written a title,
description, and tags. Each role you propose becomes a slot someone
can claim with one tap ("Ich mach's") to help make this thing
happen.

Return STRICT JSON only:
  { "roles": ["Foto", "Tonkundige", "Snacks-Pate"] }
or
  { "roles": [] }

Hard rules:
- Each role is a SHORT noun phrase — 1-3 words, max 40 chars.
- Roles describe a CONTRIBUTION SOMEONE COULD MAKE, not topics.
  Good: "Foto", "Tontechnik", "Mod", "Setup", "Snacks-Pate",
        "Anmeldung", "Bar-Aufsicht", "Koch", "Lektorat".
  Bad: "Cinema", "Music", "Friday Night", "Photography Lover".
- Never invent specifics — no names, no concrete URLs, no times.
- Match the creator's apparent language (German if the brief is German,
  French if French, English if English). Don't translate against it.
- Propose 3-6 roles when the brief is concrete enough; 0 roles when
  the brief is too vague to suggest meaningfully (e.g. just a tag
  like "music"). An empty array is acceptable and often correct.
- Roles must be MEANINGFULLY DIFFERENT from each other — don't list
  "Foto" AND "Photographer" AND "Camera".

Output ONLY the JSON object — no preamble, no prose.`;

export async function suggestRolesFromContext({
  title,
  description,
  tags,
}: {
  title: string;
  description: string;
  tags: string[];
}): Promise<string[]> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("ai_not_configured");
  }

  const userPayload = [
    `TITLE: ${title.slice(0, 200)}`,
    `DESCRIPTION: ${description.slice(0, 600) || "(none)"}`,
    `TAGS: ${tags.length ? tags.slice(0, 8).join(", ") : "(none)"}`,
  ].join("\n");

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0.3,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPayload },
    ],
  });
  const raw = completion.choices[0]?.message?.content || "{}";
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("suggest_unparseable");
  }
  const rawRoles = Array.isArray(parsed.roles) ? parsed.roles : [];
  // Run through the same sanitizer the storage layer uses — dedupe,
  // cap to 8, drop empties.
  return sanitizeRoleLabels(rawRoles);
}
