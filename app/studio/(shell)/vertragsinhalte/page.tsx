/**
 * Vertragsinhalte — its own page. The studio's reusable contract conditions
 * (Leistung, Lieferung, Nutzungsrechte, Zahlung, Storno, Datenschutz) + business
 * data, which feed every contract draft. Editor is being rebuilt in the new look;
 * the data + API (settings.conditions/business) are intact.
 */
export default function VertragsinhaltePage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-14">
      <p className="mono text-[11px] uppercase tracking-[0.22em] text-white/45">Studio · Vertragsinhalte</p>
      <h1 className="mt-2.5 font-brand text-[26px] font-bold tracking-[-0.02em] text-white sm:text-[32px]">Vertragsinhalte</h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-white/55">
        Deine wiederkehrenden Konditionen — einmal hinterlegt, fließen sie automatisch in
        jeden Vertragsentwurf: Geschäftsdaten, Leistung & Lieferung, Nutzungsrechte,
        Zahlung, Storno und Datenschutz.
      </p>
      <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-[14px] text-white/50">
        Der Editor wird gerade im neuen Look aufgebaut.
      </div>
    </div>
  );
}
