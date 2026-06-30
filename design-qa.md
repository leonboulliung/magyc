# Design QA

- Scope: Marketing-Startseite, Studio-Shell, Projektseite, Vertrag, Rechtstexte
- Tested viewport: Chrome Desktop, 1046 x 768
- Regressions checked: visuelle Hierarchie, Medien, Motion, Navigation, Routen, Themes, Build, Typprüfung
- Final result: passed

## Verified in Chrome

- Hero, Navigation, Prompt-Flow, Nutzenargumentation, Vorher/Nachher,
  Feature-Bento, Ablauf, Anwendungsfälle, Schluss-CTA und Footer erscheinen in
  der vorgesehenen Reihenfolge.
- Die Startseite bleibt eine zusammenhängende interne Scrollfläche ohne zweiten
  Dokument-Scrollbar.
- Motion-Reveals erscheinen auch beim schnellen Scrollen vollständig.
- Das statische Projektbild wird in Ablaufschritt 2 verwendet; das scrollende
  Projektvideo ausschließlich im Vorher/Nachher-Bereich.
- Die Feature-Kacheln besitzen eindeutige Icons und lesbare Kontraste.
- Rechtstexte verwenden genau einen Main-Landmark und zeigen die gelieferten
  Inhalte.
- Die Preisroute liefert 404; Projekt-Chat-UI und -API sind entfernt.
- Die gemeinsame Sticky-Navigation bleibt auf hellen und dunklen Motiven
  lesbar; sie erzeugt weder einen künstlichen Abstand zum Hero noch einen
  hinter ihr beginnenden Scrollbalken.
- Produkt-, Event-, Hochzeits-, Corporate- und Fashion-Seiten verwenden
  denselben vollflächigen Fotografie-Hero, dieselbe Typografie, Motion und
  Informationsarchitektur wie die Startseite.
- Studio- und Projekt-Theme besitzen eine gemeinsame Kontoeinstellung. Helle
  und dunkle Tokens sind explizit, Portale synchronisieren den Modus über das
  Dokument und unbekannte Werte fallen auf Hell zurück.

## Automated evidence

- TypeScript typecheck passed.
- 36 Vitest regression tests passed.
- Next.js production build passed with 39 generated static pages.
- All active public marketing and legal routes returned 200 locally;
  `/pricing` returned 404.
