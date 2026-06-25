"use client";

import { useEffect, useMemo, useState } from "react";
import { getAnonDisplayName, getAnonToken } from "@/lib/anonId";
import { readApiJson } from "@/lib/client/feedback";

export function assetPathFromData(data: Record<string, unknown>): string {
  return typeof data.path === "string" ? data.path : "";
}

export function assetUrlFromData(data: Record<string, unknown>, signedUrls: Record<string, string>): string {
  const path = assetPathFromData(data);
  if (path && signedUrls[path]) return signedUrls[path];
  if (typeof data.url === "string" && data.url.startsWith("http")) return data.url;
  return "";
}

export function useAssetUrls(spaceId: string, paths: string[]): Record<string, string> {
  const uniqueKey = useMemo(() => Array.from(new Set(paths.filter(Boolean))).sort().join("\n"), [paths]);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    const unique = uniqueKey ? uniqueKey.split("\n").filter(Boolean) : [];
    if (unique.length === 0) {
      setUrls({});
      return;
    }
    let cancelled = false;
    fetch(`/api/spaces/${spaceId}/assets/sign`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        paths: unique,
        anonToken: getAnonToken(),
        anonName: getAnonDisplayName(),
      }),
    })
      .then(readApiJson)
      .then((json) => {
        if (cancelled || !json || typeof json !== "object") return;
        const next = (json as { urls?: unknown }).urls;
        if (!next || typeof next !== "object") return;
        setUrls(next as Record<string, string>);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [spaceId, uniqueKey]);

  return urls;
}
