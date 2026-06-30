import { notFound, redirect } from "next/navigation";
import { AREAS, areaBySlug } from "@/lib/site";

const DESTINATIONS: Record<string, string> = {
  photography: "/product",
  events: "/event",
  campaigns: "/fashion",
  trips: "/",
  workshops: "/",
};

export function generateStaticParams() {
  return AREAS.map((area) => ({ area: area.slug }));
}

export default async function LegacyAreaPage({ params }: { params: Promise<{ area: string }> }) {
  const { area } = await params;
  if (!areaBySlug(area)) notFound();
  redirect(DESTINATIONS[area] ?? "/");
}
