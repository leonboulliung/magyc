# MAGYC Prompt-Architektur

MAGYC nutzt KI nicht als freien Chat, sondern als begrenzte Verarbeitungskette
für professionelle Fotografie-Aufträge. Nutzereingaben, Presets und Antworten
auf Rückfragen gelten immer als untrusted project facts und nie als Anweisung,
die Systemrolle oder Sprache zu verändern.

## 1. Intake und Rückfragen

Quelle: `lib/server/clarify.ts`

Der Intake prüft zuerst `domainFit`. Nur Foto-Aufträge, Produktionen, Shootings,
visuelle Kampagnen und deren Übergabe werden akzeptiert. Danach ermittelt er die
wenigen echten Informationslücken und wählt die günstigste passende Eingabeform:
Auswahl, Freitext oder ein konfigurierbares Element. Die sichtbare Sprache kommt
verbindlich aus der Account-Einstellung.

## 2. Analyse und Element-Auswahl

Quelle: `lib/server/classify.ts`, Stage A

Die Analyse prüft den Fotografie-Bezug erneut. Sie bewertet anschließend jedes
verfügbare Element unabhängig mit 0 bis 10. Die finale Auswahl erfolgt
deterministisch im Servercode mit Mindestwerten, Redundanzgruppen und Obergrenze.
Damit entscheidet das Modell nicht allein über die Struktur der Projektseite.

## 3. Projekt-Autor

Quelle: `lib/server/classify.ts`, Stage B

Der Autor erhält ausschließlich die bereits gewählten Elementtypen, die feste
Sprache und die Projektfakten. Er schreibt Titel, Beschreibung, Labels und die
Inhalte der gewählten Elemente für eine kollaborative Arbeitsumgebung von
Fotograf:in, Kund:in und Team. Ortskoordinaten werden nicht erfunden, sondern
anschließend durch die Geocoding-Pipeline aufgelöst.

## 4. Vertrag

Quelle: `lib/server/contractDraft.ts`

Der Vertrag wird überwiegend deterministisch aus Studio-Bedingungen,
Projektfakten und Parteien aufgebaut. Die KI formuliert nur eine kurze
Leistungsbeschreibung. Preise, Termine, Mengen, Namen und Klauseln dürfen nicht
erfunden werden; bei einem Fehler wird auf vorhandene Projektdaten zurückgefallen.

## 5. Element-Bearbeitung

Quelle: `lib/server/regenerate.ts`

Der KI-gestützte Bearbeitungspfad ist elementtyp-spezifisch und liefert strikt
strukturiertes JSON. Er darf nur Inhalte desselben Elementtyps erzeugen. Nicht
unterstützte oder sensible Elementtypen sind serverseitig gesperrt. Dieser Pfad
verändert weder Projektart noch Sprache; eine allgemeine Rotations- oder
„Alternativ“-Schaltfläche wird nicht mehr angeboten.

## Sicherheitsgrenzen

- Unpassende Eingaben werden beim Intake und nochmals beim Erstellen abgewiesen.
- Die Account-Sprache überschreibt die Sprache der freien Eingabe.
- Alle KI-Antworten werden als JSON angefordert, geparst und sanitisiert.
- Die Element-Auswahl wird nach der KI-Bewertung deterministisch begrenzt.
- Vertragsdaten mit rechtlicher oder finanzieller Wirkung stammen aus
  strukturierten Fakten und Studio-Einstellungen, nicht aus freier Erfindung.
