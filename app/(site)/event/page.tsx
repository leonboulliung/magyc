import type { Metadata } from "next";
import { SegmentLanding } from "@/components/site/SegmentLanding";
import { segmentBySlug } from "@/lib/segments";

const segment = segmentBySlug("event")!;

export const metadata: Metadata = {
  title: segment.meta.title,
  description: segment.meta.description,
};

export default function EventPhotographyPage() {
  return <SegmentLanding segment={segment} />;
}
