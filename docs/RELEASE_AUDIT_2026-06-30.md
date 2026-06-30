# Release-Audit 2026-06-30

## Nachgewiesen

- Marketing-Startseite: Fotografie-Hero, klarer Nutzen, Prompt als zweiter
  Handlungsschritt, reale Medien, Motion mit Reduced-Motion-Fallback.
- Marketing-Unterseiten: Produkt, Event, Hochzeit, Corporate, Fashion,
  Funktionsweise, Geschichte, Doku, Roadmap, Changelog und Kontakt verwenden
  dieselbe Navigation, Typografie, Fotografie-Medien und Motion-Sprache.
- Navigation: hochdeckende Sticky-Leiste mit konstant lesbarer Schrift; kein
  künstlicher Abstand zum Hero und kein hinter der Leiste beginnender
  Scrollbalken.
- „Alles an einem Ort“: alle Funktionskacheln besitzen eindeutige Icons.
- Preise: Route und Navigation entfernt; `/pricing` liefert 404.
- Projekt-Chat: Dock, Nachrichten- und Assistant-Endpunkte entfernt.
- Rechtliches: Impressum, Datenschutz und AGB entsprechen den gelieferten
  Textdateien; alle drei Routen liefern 200 und werden im Build erzeugt.
- Phasen: Planung, Vertrag, Abgeschlossen in Studio, Projekt und Admin.
- Sprache: Account-Einstellung ist serverseitig beim Rückfragen-, Studio- und
  Marketing-Erstellungsweg maßgeblich; anonyme Starts verwenden Deutsch.
- Fotografie-Grenze: fachfremde Eingaben werden im Intake und nochmals im
  direkten Create-Endpunkt mit HTTP 422 abgewiesen.
- Projekt-UI: gleiche 32-Pixel-Bedienhöhe, symmetrischer mobiler Seitenabstand,
  Versionenleiste mobil ausgeblendet, helle Theme-Tokens statt Dark-Hardcodes.
- Styles: Hintergrund und Textfarbe sind deterministisch; nur Schrift und
  Akzent sind projektbezogen. Hell und Dunkel werden aus einer Kontoeinstellung
  auf Studio, Projekt, Vertrag und portalled Dialoge übertragen.
- Studio-Motion: eine zentrale Route-Transition und eine bewegte aktive
  Navigation, jeweils mit Reduced-Motion-Fallback.

## Automatische Nachweise

- `npm run typecheck`
- `npm test -- --run` (36 Tests)
- `npm run build` (39 statische Seiten, Build erfolgreich)
- `git diff --check`
- Lokale Routen: alle aktiven Marketing- und Rechtseiten = 200;
  `/pricing` = 404.
- Live-KI: fachfremder Clarify- und Create-Request = 422; englischer Foto-Brief
  mit deutscher Einstellung erzeugt deutsche Rückfragen.

## Release-Status

- Heller Grundmodus durch den Auftraggeber freigegeben.
- Dunkle Invertierung implementiert und über explizite Theme-Tokens sowie
  Persistenztests abgesichert.
- Produktions-Build erfolgreich. Nach dem Push folgt der Smoke-Test gegen die
  echte Deployment-Umgebung, da die lokale Supabase-Konfiguration absichtlich
  keinen gültigen Produktionsschlüssel enthält.
