"use client";

import { useEffect } from "react";

/** Keeps portalled dialogs and overlays on the same account theme. */
export function StudioThemeSync({ theme }: { theme: "dark" | "light" }) {
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.studioTheme = theme;
    root.style.colorScheme = theme;
    return () => {
      delete root.dataset.studioTheme;
      root.style.colorScheme = "";
    };
  }, [theme]);
  return null;
}
