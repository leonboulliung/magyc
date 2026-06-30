import type { Metadata } from "next";
import { LegalDocument } from "@/components/site/LegalDocument";

export const metadata: Metadata = {
  title: "Allgemeine Geschäftsbedingungen — MAGYC",
  description: "Allgemeine Geschäftsbedingungen für die Nutzung von MAGYC.",
};

export default function TermsPage() {
  return <LegalDocument fileName="agb.txt" />;
}
