import type { Metadata } from "next";
import { LegalDocument } from "@/components/site/LegalDocument";
import { getDictionary } from "@/lib/i18n";
import { getServerLocale } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getServerLocale()).legalPage;
  return { title: t.termsTitle, description: t.termsDescription };
}

export default function TermsPage() {
  return <LegalDocument fileName="agb.txt" />;
}
