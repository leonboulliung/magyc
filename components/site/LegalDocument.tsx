import "server-only";

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getServerI18n } from "@/lib/i18n/server";
import type { Dictionary } from "@/lib/i18n";

function readLegalFile(fileName: string): string {
  return readFileSync(join(process.cwd(), "content", "legal", fileName), "utf8").trim();
}

function isHeading(block: string, t: Dictionary): boolean {
  if (block.includes("\n") || block.length > 100) return false;
  return /^\d+\.\s+/.test(block) || /:$/.test(block) || [
    t.legalPage.provider,
    "Hosting",
    t.legalPage.liabilityContent,
    t.legalPage.liabilityLinks,
    t.legalPage.copyright,
  ].includes(block);
}

export async function LegalDocument({ fileName }: { fileName: "impressum.txt" | "datenschutz.txt" | "agb.txt" }) {
  const { t } = await getServerI18n();
  const blocks = readLegalFile(fileName).split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  const title = blocks.shift() ?? t.legalPage.imprintFallback;
  const updated = blocks[0]?.startsWith("Stand:") ? blocks.shift() : null;

  return (
    <div className="mx-auto w-full max-w-6xl px-5 pb-28 pt-28 sm:px-8 sm:pt-36">
      <div className="grid gap-12 lg:grid-cols-[220px_minmax(0,720px)] lg:gap-20">
        <aside className="lg:sticky lg:top-28 lg:h-fit">
          <p className="mono text-[10px] uppercase tracking-[0.22em] text-black/42">{t.legalPage.legal}</p>
          {updated && <p className="mt-3 text-[13px] text-black/45">{updated}</p>}
        </aside>
        <article>
          <h1 className="font-brand text-[38px] font-bold leading-[1.04] text-[#17171a] sm:text-[58px]">{title}</h1>
          <div className="mt-12 space-y-6">
            {blocks.map((block, index) => {
              if (isHeading(block, t)) {
                return (
                  <h2 key={`${index}:${block}`} className="pt-5 font-brand text-[21px] font-bold leading-tight text-[#17171a] sm:text-[24px]">
                    {block.replace(/:$/, "")}
                  </h2>
                );
              }
              const lines = block.split("\n");
              const isList = lines.every((line) => line.startsWith("- "));
              if (isList) {
                return (
                  <ul key={index} className="space-y-2 border-l border-black/14 pl-5 text-[15px] leading-relaxed text-black/64">
                    {lines.map((line) => <li key={line}>{line.slice(2)}</li>)}
                  </ul>
                );
              }
              return (
                <p key={index} className="whitespace-pre-line text-[15px] leading-[1.75] text-black/64 sm:text-[16px]">
                  {block}
                </p>
              );
            })}
          </div>
        </article>
      </div>
    </div>
  );
}
