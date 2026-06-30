import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Manrope", "ui-sans-serif", "system-ui"],
        body: ["Manrope", "ui-sans-serif", "system-ui"],
        heading: ["Bricolage Grotesque", "Manrope", "ui-sans-serif", "system-ui"],
        brand: ["Bricolage Grotesque", "Manrope", "ui-sans-serif", "system-ui"],
        dirtyline: ["Dirtyline", "ui-sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular"],
      },
      colors: {
        ink: "#0d0d0d",
        "ink-soft": "#4a4a48",
        muted: "#8a8a85",
        paper: "#f6f6f3",
        surface: "#ffffff",
        rule: "#e6e6e1",
        "rule-strong": "#d4d4cd",
      },
      borderRadius: {
        DEFAULT: "9999px",
        xl: "20px",
        "2xl": "26px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(13,13,13,0.04), 0 1px 3px rgba(13,13,13,0.06)",
        md: "0 4px 12px -2px rgba(13,13,13,0.08), 0 2px 6px -2px rgba(13,13,13,0.06)",
        lg: "0 18px 48px -12px rgba(13,13,13,0.20), 0 6px 16px -8px rgba(13,13,13,0.12)",
      },
      letterSpacing: {
        tightest: "-0.04em",
      },
      keyframes: {
        pulseRing: {
          "0%": { transform: "scale(1)", opacity: "0.9" },
          "100%": { transform: "scale(3.2)", opacity: "0" },
        },
        ticker: {
          "0%": { transform: "translateX(0%)" },
          "100%": { transform: "translateX(-50%)" },
        },
        twinkle: {
          "0%,100%": { opacity: "0.25" },
          "50%": { opacity: "1" },
        },
        fadeIn: {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        // A signal landing on an idea: a single warm pop.
        signalPop: {
          "0%": { transform: "scale(0.4)", opacity: "0" },
          "60%": { transform: "scale(1.15)", opacity: "1" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        // The transform CTA on a resonant idea — a slow, inviting breath.
        breathe: {
          "0%,100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.015)" },
        },
        // Idea entrance: rises like a thought surfacing.
        rise: {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        pulseRing: "pulseRing 1.4s ease-out infinite",
        ticker: "ticker 60s linear infinite",
        twinkle: "twinkle 3s ease-in-out infinite",
        fadeIn: "fadeIn .35s ease-out both",
        signalPop: "signalPop .45s cubic-bezier(0.34,1.56,0.64,1) both",
        breathe: "breathe 3.6s ease-in-out infinite",
        rise: "rise .4s ease-out both",
      },
    },
  },
  plugins: [],
};
export default config;
