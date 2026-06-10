/**
 * Wikipedia resolver — given a topic (article title) or URL, hit the
 * MediaWiki REST API and return the canonical URL, a short extract,
 * and a thumbnail image when available.
 *
 * The classifier proposes article titles via OpenAI; the AI doesn't
 * always pick titles that exist. This resolver is the safety net —
 * any unresolved Wikipedia widget is left with topic-only data, which
 * the renderer handles gracefully.
 *
 * Two endpoints used:
 *  1) `/api/rest_v1/page/summary/{title}` — returns the article's
 *     canonical URL, the first paragraph extract, and a thumbnail.
 *  2) OpenSearch fallback when the direct summary 404s — finds the
 *     closest article title and recurses once.
 *
 * Language picks the wiki: `de` → de.wikipedia.org, etc. Defaults to
 * English when the language is unknown or not a wiki.
 */

import type { WikipediaWidget } from "@/lib/types";

const SUPPORTED_WIKIS = new Set([
  "en", "de", "fr", "es", "it", "pt", "nl", "pl", "ru", "ja", "zh",
  "ar", "tr", "ko", "sv", "uk", "vi", "cs", "fi", "he", "hu", "id",
  "no", "da", "el", "ro", "th",
]);

function wikiHost(language: string): string {
  const l = (language || "").toLowerCase();
  return SUPPORTED_WIKIS.has(l) ? `${l}.wikipedia.org` : "en.wikipedia.org";
}

function titleFromUrl(url: string): string | null {
  const m = url.match(/^https?:\/\/[a-z-]+\.wikipedia\.org\/wiki\/([^?#]+)/i);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1]).replace(/_/g, " ");
  } catch {
    return null;
  }
}

interface SummaryResponse {
  type?: string;
  title?: string;
  extract?: string;
  thumbnail?: { source?: string };
  content_urls?: { desktop?: { page?: string } };
}

async function fetchSummary(host: string, title: string): Promise<SummaryResponse | null> {
  const encoded = encodeURIComponent(title.replace(/\s+/g, "_"));
  const url = `https://${host}/api/rest_v1/page/summary/${encoded}?redirect=true`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2_200);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "magyc.site/0.1 (https://magyc.site)" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as SummaryResponse;
    return json;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function openSearch(host: string, query: string): Promise<string | null> {
  const url = `https://${host}/w/api.php?action=opensearch&format=json&limit=1&search=${encodeURIComponent(query)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2_200);
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "magyc.site/0.1 (https://magyc.site)" },
      signal: controller.signal,
      cache: "no-store",
    });
    if (!res.ok) return null;
    const arr = (await res.json()) as [string, string[], string[], string[]];
    return Array.isArray(arr) && arr[1] && arr[1][0] ? arr[1][0] : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resolve a Wikipedia widget. If `m.url` is set, the title is
 * extracted from it; otherwise the topic is used directly. Falls back
 * to OpenSearch when the direct summary is missing.
 *
 * Returns the widget with url/extract/thumbnailUrl filled. If
 * resolution fails, returns the widget unchanged.
 */
export async function resolveWikipedia(
  m: WikipediaWidget,
  language: string,
): Promise<WikipediaWidget> {
  const host = wikiHost(language);
  const inputTitle = m.url ? (titleFromUrl(m.url) || m.topic) : m.topic;
  if (!inputTitle) return m;

  let summary = await fetchSummary(host, inputTitle);

  // Direct miss / disambiguation: try OpenSearch on the same wiki.
  if (!summary || summary.type === "disambiguation") {
    const resolvedTitle = await openSearch(host, inputTitle);
    if (resolvedTitle && resolvedTitle !== inputTitle) {
      summary = await fetchSummary(host, resolvedTitle);
    }
  }

  // Last-ditch: try en.wikipedia if the language wiki has nothing.
  if (!summary && host !== "en.wikipedia.org") {
    summary = await fetchSummary("en.wikipedia.org", inputTitle);
  }

  if (!summary || !summary.title) return m;

  return {
    ...m,
    topic: summary.title,
    url: summary.content_urls?.desktop?.page,
    extract: summary.extract,
    thumbnailUrl: summary.thumbnail?.source,
    attribution: m.attribution ?? {
      name: "Wikipedia",
      url: summary.content_urls?.desktop?.page || `https://${host}`,
      license: "CC-BY-SA 4.0",
    },
  };
}

/**
 * Walk a modules array and resolve any Wikipedia widgets in place
 * (returns a new array). Each resolve is best-effort; failures leave
 * the widget unchanged. Runs requests in parallel.
 */
export async function resolveExternalRefs(
  modules: unknown[],
  language: string,
): Promise<unknown[]> {
  const tasks: Promise<{ i: number; m: WikipediaWidget }>[] = [];
  modules.forEach((mod, i) => {
    if (mod && typeof mod === "object" && (mod as { type?: string }).type === "wikipedia") {
      tasks.push(
        resolveWikipedia(mod as WikipediaWidget, language).then((m) => ({ i, m })),
      );
    }
  });
  if (tasks.length === 0) return modules;
  const results = await Promise.all(tasks);
  const out = [...modules];
  for (const { i, m } of results) out[i] = m;
  return out;
}
