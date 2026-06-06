"use client";

import { createContext, useContext } from "react";
import type { UIStrings } from "@/lib/types";

interface UIStringsCtx {
  strings: UIStrings;
  locale: string;
}

const Ctx = createContext<UIStringsCtx | null>(null);

export function UIStringsProvider({
  strings,
  locale,
  children,
}: {
  strings: UIStrings;
  locale: string;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={{ strings, locale }}>{children}</Ctx.Provider>;
}

export function useStrings(): UIStrings {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useStrings: missing UIStringsProvider");
  return ctx.strings;
}

export function useLocale(): string {
  return useContext(Ctx)?.locale ?? "en";
}
