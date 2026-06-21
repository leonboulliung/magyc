/**
 * Konnektoren — its own page. External connections that remove manual steps:
 * MCP (create/manage projects from your own AI app) and Mail-Forward (forward a
 * client thread to an account address → a project page is generated). In
 * preparation; placeholder in the new look.
 */
export default function KonnektorenPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-14">
      <p className="mono text-[11px] uppercase tracking-[0.22em] text-white/45">Studio · Konnektoren</p>
      <h1 className="mt-2.5 font-brand text-[26px] font-bold tracking-[-0.02em] text-white sm:text-[32px]">Konnektoren</h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-white/55">
        Verbindungen, die dir Arbeit abnehmen — damit MAGYC der Verwalter ist, nicht du.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <div className="text-[15px] font-medium text-white">MCP</div>
          <p className="mt-1 text-[13px] leading-relaxed text-white/50">
            Projektseiten direkt aus deiner eigenen KI-App erstellen und verwalten.
          </p>
          <span className="mono mt-3 inline-block rounded-full border border-white/12 px-3 py-1 text-[11px] text-white/40">In Vorbereitung</span>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-5">
          <div className="text-[15px] font-medium text-white">Mail-Forward</div>
          <p className="mt-1 text-[13px] leading-relaxed text-white/50">
            Einen Kunden-Mailverlauf an deine Account-Adresse weiterleiten → daraus wird
            automatisch eine Projektseite.
          </p>
          <span className="mono mt-3 inline-block rounded-full border border-white/12 px-3 py-1 text-[11px] text-white/40">In Vorbereitung</span>
        </div>
      </div>
    </div>
  );
}
