import { getServerI18n } from "@/lib/i18n/server";

export default async function KonnektorenPage() {
  const { t } = await getServerI18n();
  const copy = t.studio.connectorsPage;

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-14">
      <h1 className="font-brand text-[26px] font-bold tracking-[-0.02em] text-[#17171a] sm:text-[32px]">{copy.title}</h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-black/55">
        {copy.intro}
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-black/10 bg-white p-5">
          <div className="text-[15px] font-medium text-[#17171a]">{copy.mcpTitle}</div>
          <p className="mt-1 text-[13px] leading-relaxed text-black/50">
            {copy.mcpBody}
          </p>
          <span className="mono mt-3 inline-block rounded-full border border-black/12 px-3 py-1 text-[11px] text-black/40">{copy.pending}</span>
        </div>
        <div className="rounded-2xl border border-black/10 bg-white p-5">
          <div className="text-[15px] font-medium text-[#17171a]">{copy.mailTitle}</div>
          <p className="mt-1 text-[13px] leading-relaxed text-black/50">
            {copy.mailBody}
          </p>
          <span className="mono mt-3 inline-block rounded-full border border-black/12 px-3 py-1 text-[11px] text-black/40">{copy.pending}</span>
        </div>
      </div>
    </div>
  );
}
