# MAGYC — Design-Prinzipien (Look & Feel des Nutzerbereichs)

_Fundament für den Neuaufbau des Studios. Die Projektseite + Elemente sind
ausgenommen (lange iteriert, funktionieren). Diese Prinzipien gelten für alle
Account-/Studio-Seiten, damit das Look & Feel ein System ist, kein Pro-Screen-Zufall._

## Wer & warum
Der Nutzer ist ein **Kreativer, der zum Verwalter gezwungen wurde.** Das Produkt-
versprechen: _„Ich verstehe dich. Du wolltest mit Kreativität Geld verdienen, nicht
Verwalter-Sklave sein. Schluss damit."_ Jede Designentscheidung nimmt ihm Gewicht ab.

## Haltung
Ein **präzises, ruhiges Instrument** — sachlich, vertrauenswürdig, dicht (nicht „bulky").
Näher an Finanz-/Engineering-Werkzeug als an verspielter KI-App. Confidence durch
Zurückhaltung. (Geistige Referenzen: Linear, Stripe/Vercel, Notion.)

## Die Bedien-Prinzipien (verbindlich)
1. **Die App ist der Verwalter, nicht er.** Wo der Mensch selbst strukturiert/eintippt/
   konfiguriert, ist das Versprechen gebrochen.
2. **Vorbefüllt statt leer. Bestätigen statt Ausfüllen.** Default jeder Seite = schon
   gefüllt (Profil, Konditionen, Plan). Dominante Handlung: prüfen & freigeben.
3. **Ein Eingang → strukturierter Ausgang.** Rohes rein (Satz, Mail, Sprache), Struktur
   raus. Diesen Moment oft + sichtbar erzeugen — er _ist_ das „Ich verstehe dich".
4. **Standard statt Konfiguration.** Einmal einstellen, nie wieder. Vernünftige Defaults,
   Fortgeschrittenes versteckt bis gebraucht.
5. **Verbinden statt erfinden — und es zeigen.** Herkunfts-Marker (aus deinem Plan / aus
   deinen Einstellungen / verbunden / KI-Vorschlag / fehlt noch) machen sichtbar, dass die
   App die Arbeit tut. Das ist der Vertrauensbeweis und die Marken-Signatur.
6. **Zeig das Minimum.** Progressive Disclosure. Keine Sackgassen, keine leeren Voids.
7. **Tempo ist Respekt.** Optimistische UI, Autosave, Undo, sofortiges Feedback.

## Visuelle Sprache
- **Schwarz ist die Bühne, nie der Inhalt.** Das Schwarz lebt erst, wenn Inhalt es
  bewohnt — primär die **eigenen Bilder** des Fotografen, sonst **Mesh-Gradienten**
  (`MoodGradient`, geseedet pro Projekt: Stimmung ohne Inhalt vorwegzunehmen), Licht/Tiefe,
  **ein** warmer Akzent, warme Display-Typo + menschliche Sprache. Flaches kaltes #000 =
  Leichenhaus; geschichtetes, beleuchtetes, bewohntes Schwarz = Studio.
- **Typo führt** (Text → Struktur): Display für Headlines, lesbarer Body, **Mono** für
  Daten/Herkunft/System-Labels.
- **Bewegung nur, wenn sie etwas erklärt** (Kristallisation, Umgebungswechsel).

## Der Ernst-Gradient (Umgebungen)
Die Reise **Idee → Plan → Vertrag** ist als Temperatur sichtbar:
- **Planen** (Projektseite): offen, generativ, leicht — ehrt den Künstler.
- **Absegnung/Vertrag**: dicht, typografisch streng, ruhig, formell — gibt ihm die
  Rüstung für den Geld-/Haftungs-Moment. Übergänge spürbar + mit Referenz zurück.

## Stimme
Ein **verständnisvoller Verbündeter**, der den Künstler-Schmerz kennt. Warm, klar, souverän,
Deutsch. Benennt die Erleichterung an Schlüsselmomenten („Fertig — du musstest nichts
ausfüllen." · „Damit du das nicht ausdiskutieren musst." · „Abgestimmt und unterschrieben.
Geh fotografieren."). Nie Jargon, nie das Gefühl, ein Sachbearbeiter zu sein.

## Bausteine (Stand)
- `components/PromptComposer.tsx` — das geteilte Erstellen-Feld (Marketing = Studio = Zentrum).
- `components/MoodGradient.tsx` — geseedete Mesh-Gradienten (Bühne/Leben).
- `components/studio/StudioHome.tsx` — prompt-first Studio-Home (erstes Muster).
- `components/ui/Toggle.tsx`, `components/studio/StudioPageHeader.tsx` — gemeinsame Bausteine.
