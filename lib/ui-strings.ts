/**
 * Server-only module. Never import in Client Components.
 *
 * Detects the request locale, then returns UI label strings for that
 * locale — from Supabase cache if available, otherwise generated fresh
 * by the AI and stored for subsequent requests.
 */

import OpenAI from "openai";
import { cookies, headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase";
import type { UIStrings } from "@/lib/types";

// ── Locale detection ─────────────────────────────────────────────────────────

export async function getRequestLocale(): Promise<string> {
  const cookieStore = await cookies();
  const saved = cookieStore.get("preferred_locale")?.value;
  if (saved && /^[a-z]{2,3}$/.test(saved)) return saved;

  const headersList = await headers();
  const accept = headersList.get("accept-language") ?? "";
  return parseAcceptLanguage(accept);
}

function parseAcceptLanguage(header: string): string {
  if (!header) return "en";
  const tags = header.split(",").map((l) => l.split(";")[0].trim().toLowerCase());
  // "en-US" → "en", "de-DE" → "de", "zh-Hans" → "zh"
  return tags[0]?.split("-")[0] || "en";
}

// ── Cache + generation ───────────────────────────────────────────────────────

export async function getUIStrings(locale: string): Promise<UIStrings> {
  const cached = await tryLoadCache(locale);
  if (cached) return cached;

  const strings = await generateUIStrings(locale);
  tryStoreCache(locale, strings);
  return strings;
}

async function tryLoadCache(locale: string): Promise<UIStrings | null> {
  try {
    const { data } = await supabaseAdmin()
      .from("ui_strings_cache")
      .select("strings")
      .eq("locale", locale)
      .maybeSingle();
    return data ? (data.strings as UIStrings) : null;
  } catch {
    return null;
  }
}

function tryStoreCache(locale: string, strings: UIStrings): void {
  try {
    void supabaseAdmin()
      .from("ui_strings_cache")
      .upsert(
        { locale, strings, generated_at: new Date().toISOString() },
        { onConflict: "locale" },
      );
  } catch {
    // noop — caching is best-effort
  }
}

// ── AI generation ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You generate UI label strings for "Creator" — a minimal workspace builder.
A user writes a thought and the AI builds a shareable structured workspace around it.
The app's aesthetic is editorial and minimal: short ALL CAPS for action labels and
section headers, normal sentence case for longer explanatory text.

Translate ALL keys below into the language with BCP 47 tag "{LOCALE}".
Use the appropriate informal register (e.g. "du" in German, "tu" in French/Spanish).

Return STRICT JSON — exactly this structure, all keys present, values in the target language:

{
  "home": {
    "new": "NEW",
    "headline": "What's on your mind?",
    "subtitle": "A thought, an idea, a question, a concern, a plan. Write it down — a small shareable workspace will be built around it.",
    "placeholder": "e.g. I'm thinking about how to start a small writing circle in my neighbourhood this summer.",
    "tagline": "✦ AI BUILDS THE STRUCTURE · NO FEED, NO FOLLOWERS",
    "signIn": "SIGN IN",
    "generating": "BUILDING…",
    "generate": "✦ CREATE WORKSPACE →",
    "signUp": "SIGN UP TO START →",
    "footer": "You create — the app doesn't broadcast for you. You take it out there when you're ready.",
    "errorTooShort": "Write a sentence — whatever's in your head.",
    "errorNotSignedIn": "You need to be signed in.",
    "errorRateLimited": "Take a breath — try again in a few seconds.",
    "errorAiUnavailable": "The AI service is unavailable right now.",
    "errorGenerateFailed": "Could not generate."
  },
  "space": {
    "notFound": "Not found.",
    "back": "← BACK",
    "byPrefix": "BY",
    "yours": "YOUR WORKSPACE",
    "defaultTitle": "A Workspace",
    "signIn": "SIGN IN",
    "newSpace": "← NEW WORKSPACE"
  },
  "share": {
    "shared": "SHARED ✓",
    "copied": "LINK COPIED ✓",
    "button": "↗ SHARE",
    "defaultTitle": "A Workspace"
  },
  "primitives": {
    "brief": "THIS IS ABOUT",
    "helpNeededLabel": "WHERE HELP WOULD DO GOOD",
    "helpNeededYou": "· YOU",
    "helpNeededTaken": "TAKEN",
    "helpNeededClaim": "I'LL DO IT →",
    "nextStepsLabel": "HOW THIS COULD MOVE FORWARD",
    "nextStepsEmpty": "Nothing yet. As the idea gets clearer, a path can emerge here.",
    "openQuestionsLabel": "OPEN QUESTIONS",
    "placeLabel": "PLACE",
    "resourcesLabel": "REFERENCES",
    "resourcesEmpty": "Nothing yet. If someone has a link or reference — add it here.",
    "resourcesUrlError": "A URL must start with http:// or https://",
    "resourcesAddError": "Could not add.",
    "resourcesCaptionPlaceholder": "Short note (optional)",
    "resourcesAdd": "ADD REFERENCE →",
    "resourcesSignIn": "SIGN IN TO SHARE REFERENCES →",
    "voicesLabel": "VOICES",
    "voicesEmpty": "Nothing yet. Be the first.",
    "voicesPlaceholder": "Say something, @{username}…",
    "voicesPlaceholderAnon": "Say something…",
    "voicesPost": "POST →",
    "voicesSignIn": "SIGN IN TO RESPOND →"
  }
}

Rules:
- Preserve ALL CAPS for short action labels and section headers
- Preserve symbols exactly: ✦ → ← ↗ ✓ · …
- Keep "@{username}" in voicesPlaceholder exactly as-is (it is a code placeholder)
- For "placeholder": write a culturally relevant example about starting a local community initiative
- Return ONLY the JSON object, no preamble`;

async function generateUIStrings(locale: string): Promise<UIStrings> {
  if (!process.env.OPENAI_API_KEY) {
    return emptyStrings();
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const prompt = SYSTEM_PROMPT.replace(/{LOCALE}/g, locale);

  const completion = await client.chat.completions.create({
    model: "gpt-4o-mini",
    response_format: { type: "json_object" },
    temperature: 0.2,
    messages: [
      { role: "system", content: prompt },
      { role: "user", content: locale },
    ],
  });

  const raw = completion.choices[0]?.message?.content ?? "{}";
  return JSON.parse(raw) as UIStrings;
}

function emptyStrings(): UIStrings {
  return {
    home: {
      new: "", headline: "", subtitle: "", placeholder: "", tagline: "",
      signIn: "", generating: "", generate: "", signUp: "", footer: "",
      errorTooShort: "", errorNotSignedIn: "", errorRateLimited: "",
      errorAiUnavailable: "", errorGenerateFailed: "",
    },
    space: {
      notFound: "", back: "", byPrefix: "", yours: "", defaultTitle: "",
      signIn: "", newSpace: "",
    },
    share: { shared: "", copied: "", button: "", defaultTitle: "" },
    primitives: {
      brief: "", helpNeededLabel: "", helpNeededYou: "", helpNeededTaken: "",
      helpNeededClaim: "", nextStepsLabel: "", nextStepsEmpty: "",
      openQuestionsLabel: "", placeLabel: "", resourcesLabel: "",
      resourcesEmpty: "", resourcesUrlError: "", resourcesAddError: "",
      resourcesCaptionPlaceholder: "", resourcesAdd: "", resourcesSignIn: "",
      voicesLabel: "", voicesEmpty: "", voicesPlaceholder: "",
      voicesPlaceholderAnon: "", voicesPost: "", voicesSignIn: "",
    },
  };
}
