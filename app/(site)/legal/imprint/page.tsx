import type { Metadata } from "next";
import { LegalDocument } from "@/components/site/LegalDocument";

export const metadata: Metadata = { title: "Impressum — MAGYC" };

export default function ImprintPage() {
  return <LegalDocument fileName="impressum.txt" />;
}
