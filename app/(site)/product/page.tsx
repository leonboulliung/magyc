import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { Container } from "@/components/site/sections";
import { MediaPlaceholder } from "@/components/site/MediaPlaceholder";
import { EmergentBackdrop } from "@/components/site/EmergentBackdrop";

export const metadata: Metadata = {
  title: "MAGYC for product photographers",
  description:
    "From the client's first email to the finished hand-off — one place that builds itself around the shoot. Enter the project once; never re-type the same brief again.",
};

/* ── Marketing copy, kept in one place so it's easy to iterate ──────────
   This is positioning copy for the Commercial/Product beachhead (see
   docs/STRATEGY.md). It describes the product vision honestly; image areas
   stay as labelled placeholders (no stock photos by design). */

const LIFECYCLE: { n: string; title: string; lead: string; note: string }[] = [
  {
    n: "01",
    title: "Brief",
    lead:
      "Forward the client's email — or type the job in a sentence. MAGYC reads it and builds the project: deliverables, usage, shoot date, location, crew.",
    note: "The brief stops living in your inbox.",
  },
  {
    n: "02",
    title: "Produce",
    lead:
      "One shared space for the shoot. Client, assistant, stylist and retoucher work in the same structure — shot list, approvals and feedback in one place.",
    note: "Everyone sees the same source of truth.",
  },
  {
    n: "03",
    title: "Present",
    lead:
      "When the shoot is done, one click turns the same project into a polished, branded hand-off page. The data is already there — nothing to rebuild.",
    note: "From planning surface to presentation, automatically.",
  },
];

type Block = { icon: ReactNode; name: string; role: string };

const I = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    {d.split("|").map((p, i) => (
      <path key={i} d={p} />
    ))}
  </svg>
);

const BLOCKS: Block[] = [
  { icon: <I d="M4 7l8-4 8 4-8 4-8-4z|M4 7v10l8 4 8-4V7|M12 11v10" />, name: "Deliverables", role: "Every asset, format and quantity the client expects." },
  { icon: <I d="M4 12l5 5L20 6" />, name: "Approvals", role: "Sign-off checkpoints the client ticks — client or internal." },
  { icon: <I d="M9 8a3 3 0 1 0 0-.01|M3.5 19a5.5 5.5 0 0 1 11 0|M16 6a3 3 0 0 1 0 6|M21 19a5.5 5.5 0 0 0-4-5.3" />, name: "Crew & roles", role: "Assistant, stylist, retoucher, agency contact — claimed, not chased." },
  { icon: <I d="M12 3l9 5-9 5-9-5 9-5z|M3 13l9 5 9-5" />, name: "Work packages", role: "The set, the edit, the delivery — split into ownable chunks." },
  { icon: <I d="M9 6h11|M9 12h11|M9 18h11|M4 5.5l1 1 2-2|M4 11.5l1 1 2-2|M4 17.5l1 1 2-2" />, name: "Shot list", role: "Every angle and setup, ticked off on set." },
  { icon: <I d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z|M3 9h18|M8 2v4|M16 2v4" />, name: "Schedule", role: "Shoot day, review call, delivery date — in context." },
  { icon: <I d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z|M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" />, name: "Location", role: "Studio or set, pinned on a map for everyone." },
  { icon: <I d="M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z|M8.5 11a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z|M21 17l-5-5L5 21" />, name: "Moodboard", role: "Reference and inspiration, gathered in one frame." },
  { icon: <I d="M21 12.5L12.5 21a5 5 0 0 1-7-7l9-9a3.3 3.3 0 0 1 4.7 4.7l-9 9a1.6 1.6 0 0 1-2.3-2.3l8-8" />, name: "Files", role: "Briefs, contracts, specs — attached where they belong." },
  { icon: <I d="M12 20h9|M16.5 3.5a2 2 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />, name: "Notes", role: "Anything that doesn't fit a box." },
  { icon: <I d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z|M9.3 9a2.5 2.5 0 1 1 3.2 2.4c-.8.3-1 .8-1 1.6" />, name: "Q&A", role: "Open questions the client or team can answer." },
  { icon: <I d="M21 12a8 8 0 0 1-11.5 7.2L3 21l1.8-6.5A8 8 0 1 1 21 12z|M8.5 12h7" />, name: "Discussion", role: "The running conversation, kept beside the work." },
];

function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="mono text-[11px] uppercase tracking-[0.22em] text-white/55">{children}</p>;
}

export default function ProductPhotographyPage() {
  return (
    <div className="relative">
      <EmergentBackdrop />

      <div className="relative z-10">
        {/* ── Hero ─────────────────────────────────────────────── */}
        <Container className="pt-32 sm:pt-40 pb-12 sm:pb-20">
          <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <Eyebrow>For product &amp; commercial photographers</Eyebrow>
              <h1 className="mt-5 font-heading text-[40px] italic leading-[1.0] tracking-[-0.01em] text-white sm:text-[64px]">
                The photo is the easy part.
              </h1>
              <p className="mt-6 max-w-xl text-[18px] leading-relaxed text-white/70 sm:text-[20px]">
                The brief, the rights, the shot list, the approvals, the hand-off —
                the margin is made or lost there. MAGYC turns the client&apos;s first
                email into a shared project, and the finished shoot into a presentation.
                Enter it once; never re-type the same job again.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <Link
                  href="/#start"
                  className="liquid-glass-strong rounded px-5 py-2.5 font-body text-sm font-medium text-white transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]"
                >
                  Start a project
                </Link>
                <Link href="/showcase" className="mono text-[12px] uppercase tracking-widest text-white/55 hover:text-white">
                  See a sample project →
                </Link>
              </div>
            </div>
            <MediaPlaceholder label="Product shoot · hero" ratio="4 / 5" caption="Real creative image · folgt" />
          </div>
        </Container>

        {/* ── The problem ──────────────────────────────────────── */}
        <Container className="py-16 sm:py-24">
          <div className="border-t border-white/10 pt-14">
            <Eyebrow>The real job</Eyebrow>
            <h2 className="mt-4 max-w-3xl font-heading text-[30px] italic leading-[1.08] text-white sm:text-[44px]">
              A commercial shoot is a coordination problem wearing a camera.
            </h2>
            <div className="mt-10 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-3">
              {[
                ["2–6 tools", "per project — CRM, gallery, email, spreadsheet, contract — each needing the same data re-typed."],
                ["The invisible hours", "briefing, usage rights, approvals, delivery config: where the margin quietly leaks away."],
                ["Re-built from scratch", "the hand-off and the case study get assembled by hand, every single time."],
              ].map(([big, small]) => (
                <div key={big} className="bg-black/40 p-6">
                  <div className="font-heading text-[24px] italic text-white sm:text-[28px]">{big}</div>
                  <p className="mt-3 text-[14px] leading-relaxed text-white/60">{small}</p>
                </div>
              ))}
            </div>
          </div>
        </Container>

        {/* ── How it works — the lifecycle ─────────────────────── */}
        <Container className="py-16 sm:py-24">
          <div className="border-t border-white/10 pt-14">
            <Eyebrow>One project, three stages</Eyebrow>
            <h2 className="mt-4 max-w-2xl font-heading text-[30px] italic leading-[1.08] text-white sm:text-[44px]">
              The same project, carried from brief to hand-off.
            </h2>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {LIFECYCLE.map((s) => (
                <div key={s.n} className="liquid-glass rounded-2xl p-6">
                  <div className="mono text-[12px] tracking-widest text-white/40">{s.n}</div>
                  <h3 className="mt-3 font-heading text-[26px] italic text-white">{s.title}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-white/68">{s.lead}</p>
                  <p className="mt-4 text-[13px] leading-relaxed text-white/45">{s.note}</p>
                </div>
              ))}
            </div>
          </div>
        </Container>

        {/* ── Building blocks ──────────────────────────────────── */}
        <Container className="py-16 sm:py-24">
          <div className="border-t border-white/10 pt-14">
            <Eyebrow>The building blocks</Eyebrow>
            <h2 className="mt-4 max-w-2xl font-heading text-[30px] italic leading-[1.08] text-white sm:text-[44px]">
              Not a template. A kit of small, sharp parts.
            </h2>
            <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-white/68">
              MAGYC composes each project from focused building blocks and picks the
              ones your shoot actually needs — instead of forcing it into one rigid form.
            </p>
            <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
              {BLOCKS.map((b) => (
                <div key={b.name} className="bg-black/40 p-6 transition-colors duration-200 hover:bg-black/20">
                  <div className="text-white/85">{b.icon}</div>
                  <h3 className="mt-4 font-body text-[16px] font-medium text-white">{b.name}</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-white/55">{b.role}</p>
                </div>
              ))}
            </div>
            <p className="mono mt-6 text-[11px] uppercase tracking-[0.2em] text-white/35">
              …and more — MAGYC chooses, configures and arranges them for each job.
            </p>
          </div>
        </Container>

        {/* ── The present wow (Module 3) ───────────────────────── */}
        <Container className="py-16 sm:py-24">
          <div className="border-t border-white/10 pt-14">
            <div className="grid items-center gap-12 lg:grid-cols-2">
              <div>
                <Eyebrow>When the shoot is done</Eyebrow>
                <h2 className="mt-4 font-heading text-[30px] italic leading-[1.08] text-white sm:text-[46px]">
                  The same project, reborn as a presentation.
                </h2>
                <p className="mt-6 max-w-xl text-[17px] leading-relaxed text-white/70">
                  The location, the crew, the deliverables, the final selects — already
                  in the system. One click re-composes them into a branded recap and
                  hand-off page. Adjust the colours and a few words; it&apos;s essentially done.
                </p>
                <div className="mt-8 flex items-center gap-3 text-[13px] text-white/50">
                  <span className="mono rounded border border-white/15 px-2.5 py-1 tracking-widest">PLAN</span>
                  <span aria-hidden className="text-white/30">→</span>
                  <span className="mono rounded border border-white/15 px-2.5 py-1 tracking-widest text-white/80">PRESENT</span>
                </div>
              </div>
              <MediaPlaceholder label="Auto-generated presentation page" ratio="4 / 3" caption="Annotated example · folgt" />
            </div>
          </div>
        </Container>

        {/* ── Positioning: AI does the busywork ────────────────── */}
        <Container className="py-16 sm:py-24">
          <div className="liquid-glass rounded-2xl border-t border-white/10 p-8 sm:p-12">
            <Eyebrow>Where the AI helps</Eyebrow>
            <h2 className="mt-4 max-w-3xl font-heading text-[28px] italic leading-[1.1] text-white sm:text-[40px]">
              The AI does the busywork. You keep the craft.
            </h2>
            <p className="mt-6 max-w-2xl text-[17px] leading-relaxed text-white/70">
              MAGYC never touches your images or your style. It handles the structure,
              the admin and the hand-off — the invisible hours between shoots. The
              shoot is yours, and so is the final word.
            </p>
          </div>
        </Container>

        {/* ── CTA ──────────────────────────────────────────────── */}
        <Container className="pb-28 pt-8 text-center sm:pb-36">
          <h2 className="mx-auto max-w-2xl font-heading text-[32px] italic leading-[1.05] text-white sm:text-[52px]">
            Start your next shoot in MAGYC.
          </h2>
          <div className="mt-9 flex items-center justify-center">
            <Link
              href="/#start"
              className="liquid-glass-strong rounded px-6 py-3 font-body text-sm font-medium text-white transition-all duration-200 hover:scale-[1.03] active:scale-[0.98]"
            >
              Try it free
            </Link>
          </div>
        </Container>
      </div>
    </div>
  );
}
