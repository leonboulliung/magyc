import type { Metadata } from "next";
import { SegmentLanding } from "@/components/site/SegmentLanding";
import { segmentBySlug } from "@/lib/segments";

const segment = segmentBySlug("fashion")!;

export const metadata: Metadata = {
  title: segment.meta.title,
  description: segment.meta.description,
};

export default function FashionPhotographyPage() {
  return <SegmentLanding segment={segment} />;
}
