import type { Metadata } from "next";
import { SegmentLanding } from "@/components/site/SegmentLanding";
import { getServerLocale } from "@/lib/i18n/server";
import { segmentBySlug } from "@/lib/segments";

const segment = segmentBySlug("fashion")!;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getServerLocale();
  const localizedSegment = segmentBySlug("fashion", locale)!;
  return {
    title: localizedSegment.meta.title,
    description: localizedSegment.meta.description,
  };
}

export default function FashionPhotographyPage() {
  return <SegmentLanding segment={segment} />;
}
