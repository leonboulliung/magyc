import type { Metadata } from "next";
import { LegalDocument } from "@/components/site/LegalDocument";

export const metadata: Metadata = {
  title: "Datenschutzerklärung — MAGYC",
  description: "Informationen zur Verarbeitung personenbezogener Daten bei MAGYC.",
};

export default function PrivacyPage() {
  return <LegalDocument fileName="datenschutz.txt" />;
}
