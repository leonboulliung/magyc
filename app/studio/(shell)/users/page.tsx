import { auth, currentUser } from "@clerk/nextjs/server";
import { supabaseAdmin } from "@/lib/supabase";

// Clients are derived from live contract data; never cache.
export const dynamic = "force-dynamic";

interface ClientRow {
  spaceId: string;
  projectTitle: string;
  name: string;
  email: string;
  signed: boolean;
}

/**
 * Nutzer — Team & Kunden. The team is the account owner (multi-seat is a later
 * step); clients are derived from the contract parties on the owner's projects,
 * so the list reflects who you've actually drawn up agreements with.
 */
export default async function StudioUsersPage() {
  const { userId } = await auth();
  if (!userId) return null;

  const user = await currentUser();
  const admin = supabaseAdmin();

  const { data: spaces } = await admin
    .from("spaces")
    .select("id, title")
    .eq("owner_id", userId)
    .is("deleted_at", null);
  const titleById = new Map((spaces ?? []).map((s) => [s.id, s.title as string]));
  const spaceIds = (spaces ?? []).map((s) => s.id);

  let clients: ClientRow[] = [];
  if (spaceIds.length) {
    const { data: contracts } = await admin
      .from("project_contracts")
      .select("space_id, parties, client_signed_at")
      .in("space_id", spaceIds);
    clients = (contracts ?? [])
      .map((c) => {
        const client = (c.parties as { client?: { name?: string; email?: string } } | null)?.client;
        const name = (client?.name ?? "").trim();
        const email = (client?.email ?? "").trim();
        if (!name && !email) return null;
        return {
          spaceId: c.space_id as string,
          projectTitle: titleById.get(c.space_id as string) ?? "Projekt",
          name: name || "—",
          email,
          signed: !!c.client_signed_at,
        } as ClientRow;
      })
      .filter((c): c is ClientRow => c !== null);
  }

  const ownerName = user?.fullName || user?.firstName || user?.username || "Du";
  const ownerEmail = user?.primaryEmailAddress?.emailAddress ?? "";
  const ownerInitial = (ownerName || "S").slice(0, 1).toUpperCase();

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-12 sm:px-8 sm:py-14">
      <p className="mono text-[11px] uppercase tracking-[0.22em] text-black/45">Studio · Nutzer</p>
      <h1 className="mt-2.5 font-brand text-[26px] font-bold tracking-[-0.02em] text-[#17171a] sm:text-[32px]">Team & Kunden</h1>
      <p className="mt-3 max-w-2xl text-[14px] leading-relaxed text-black/55">
        Wer arbeitet im Studio, und mit wem hast du Projekte vereinbart.
      </p>

      {/* Team */}
      <section className="mt-8 rounded-2xl border border-black/10 bg-white p-5 sm:p-6">
        <h2 className="text-[15px] font-semibold text-[#17171a]">Team</h2>
        <div className="mt-4 flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-[15px] font-semibold text-[#17171a]" style={{ background: "linear-gradient(135deg,#8b7bff,#39d2b4)" }}>
            {user?.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : ownerInitial}
          </div>
          <div className="min-w-0">
            <div className="truncate text-[14px] font-medium text-white">{ownerName}</div>
            {ownerEmail && <div className="truncate text-[13px] text-black/45">{ownerEmail}</div>}
          </div>
          <span className="mono ml-auto rounded-full border border-black/12 px-2.5 py-1 text-[10px] uppercase tracking-widest text-black/45">Inhaber:in</span>
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-black/35">
          Mitarbeiter:innen einladen kommt als nächster Schritt — aktuell ist dein Studio ein Ein-Personen-Konto.
        </p>
      </section>

      {/* Kunden */}
      <section className="mt-5 rounded-2xl border border-black/10 bg-white p-5 sm:p-6">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-[15px] font-semibold text-[#17171a]">Kunden</h2>
          <span className="mono text-[11px] tracking-widest text-black/35">{clients.length}</span>
        </div>
        {clients.length === 0 ? (
          <p className="mt-4 text-[13px] text-black/35">
            Noch keine Kunden. Sobald du einen Vertrag erstellst, erscheinen die Kundendaten hier.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {clients.map((c, i) => (
              <a key={i} href={`/s/${c.spaceId}/vertrag`} className="group flex items-center gap-3.5 rounded-xl border border-black/10 bg-white px-4 py-3 transition-colors hover:border-black/25">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-black/[0.06] text-[13px] font-semibold text-black/80">
                  {(c.name || c.email || "?").slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-medium text-white">{c.name}</div>
                  <div className="truncate text-[13px] text-black/45">{c.email || "—"} · {c.projectTitle}</div>
                </div>
                {c.signed ? (
                  <span className="mono shrink-0 rounded-full px-2.5 py-1 text-[10px] uppercase tracking-widest" style={{ border: "1px solid rgba(34,197,94,0.35)", color: "rgba(134,239,172,0.9)" }}>Unterschrieben</span>
                ) : (
                  <span className="mono shrink-0 rounded-full border border-black/12 px-2.5 py-1 text-[10px] uppercase tracking-widest text-black/40">Offen</span>
                )}
              </a>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
