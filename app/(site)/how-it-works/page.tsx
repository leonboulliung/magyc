import type { Metadata } from "next";
import Link from "next/link";
import { Section, Eyebrow } from "@/components/site/sections";
import { BouncyCardsFeatures } from "@/components/ui/bounce-card-features";
import { brand } from "@/lib/site";

export const metadata: Metadata = {
  title: "So funktioniert's — MAGYC",
  description:
    "Von der Idee zum unterschriebenen Auftrag: Wie MAGYC den Workflow für Fotograf:innen begleitet — Plan, gemeinsame Abstimmung, Vertrag, Abschluss.",
};

const STEPS = [
  {
    title: "Idee eingeben",
    description: "Ein Satz genügt. Deine Presets, Schnellbausteine und Vertragsdaten fließen automatisch mit ein.",
    gradient: "linear-gradient(135deg, #8b7bff, #6d8bff)",
  },
  {
    title: "Plan entsteht",
    description: "MAGYC macht daraus eine Projektseite aus passenden Elementen — Moodboard, Shotlist, Orte, Deliverables.",
    gradient: "linear-gradient(135deg, #5b9dff, #39d2b4)",
  },
  {
    title: "Gemeinsam schärfen",
    description: "Teile den Link: Kunde und Team kommentieren, wählen und laden hoch. @magyc begleitet durchgehend.",
    gradient: "linear-gradient(135deg, #39d2b4, #57c98a)",
  },
  {
    title: "Absegnen & unterschreiben",
    description: "Plan sperren → der Vertrag entsteht aus deinen Konditionen. Beide signieren — per Klick oder Unterschrift.",
    gradient: "linear-gradient(135deg, #f5b740, #f4719b)",
  },
  {
    title: "Abschluss",
    description: "Finale Galerie und Referenzen anhängen. Dein Kunde sieht über den Link sofort: fertig und abgeschlossen.",
    gradient: "linear-gradient(135deg, #7bd88f, #39d2b4)",
  },
];

export default function HowItWorksPage() {
  return (
    <>
      <Section className="pt-20 pb-10 sm:pt-28">
        <Eyebrow>So funktioniert's</Eyebrow>
        <h1
          className="mt-3 font-semibold tracking-tight"
          style={{ fontSize: "clamp(34px, 6vw, 60px)", lineHeight: 1.04, color: brand.ink, maxWidth: 820 }}
        >
          Von der Idee zum unterschriebenen Auftrag.
        </h1>
        <p className="mt-5 leading-relaxed" style={{ fontSize: 18, color: brand.muted, maxWidth: 640 }}>
          MAGYC verwandelt eine kreative Idee in einen klaren Plan, den du mit Kund:innen gemeinsam schärfst —
          und am Ende in einen verbindlichen Vertrag. Du fotografierst, MAGYC übernimmt das Drumherum.
        </p>
      </Section>

      <Section className="pt-0 pb-12">
        <BouncyCardsFeatures
          eyebrow="Der Ablauf"
          title="Fünf Schritte, ein durchgehender Faden."
          description="Vom ersten Satz bis zum Abschluss bleibt alles an einem Ort — und ein Agent begleitet dich dabei."
          cards={STEPS}
        />
      </Section>

      <Section divider className="text-center">
        <h2 className="font-semibold tracking-tight" style={{ fontSize: "clamp(26px, 4vw, 40px)", color: brand.ink }}>
          Probier's mit deiner eigenen Idee.
        </h2>
        <div className="mt-6 flex justify-center">
          <Link
            href="/#start"
            className="font-mono uppercase tracking-widest rounded-full px-6 py-3"
            style={{ fontSize: 12, background: brand.ink, color: brand.bg }}
          >
            Jetzt starten
          </Link>
        </div>
      </Section>
    </>
  );
}
