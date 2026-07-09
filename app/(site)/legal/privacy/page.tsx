import type { Metadata } from "next";
import { LegalDocument } from "@/components/site/LegalDocument";
import { getDictionary } from "@/lib/i18n";
import { getServerLocale } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const t = getDictionary(await getServerLocale()).legalPage;
  return { title: t.privacyTitle, description: t.privacyDescription };
}

export default function PrivacyPage() {
  return <LegalDocument fileName="datenschutz.txt" />;
}
