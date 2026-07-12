#!/usr/bin/env node
//
// i18n guard: fails if any hardcoded German user-facing string survives outside
// the dictionaries. It is the machine-checked definition of "no leftovers" and,
// wired into CI, it stops new German strings from creeping in — so every future
// change has to go through the dictionary (and a 3rd language stays trivial).
//
// Comments in this codebase are English (house rule), so German inside app/ and
// components/ is almost always user-facing copy. We flag umlauts/ß and a set of
// unambiguous German words inside string literals / JSX text. Escape hatch:
// put `i18n-ignore` in a trailing comment on the line for a legitimate case
// (brand terms, fixtures, etc.).
//
//   node scripts/i18n-lint.mjs            # report + exit 1 if any found
//   node scripts/i18n-lint.mjs --list     # just print the worklist

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const ROOTS = [
  "app",
  "components",
  "lib/site.ts",
  "lib/studioPresets.ts",
  "lib/projectModes.ts",
  "lib/client/errors.ts",
  "lib/client/feedback.ts",
  "lib/home/flow.ts",
];
const EXCLUDE_DIRS = new Set(["node_modules", ".next", "dev"]);
const EXCLUDE_FILE = (p) =>
  p.includes("/i18n/") ||
  p.includes("dictionaries/") ||
  p.endsWith(".d.ts") ||
  p.includes("__tests__") ||
  /\.(test|spec)\.tsx?$/.test(p);

// Unambiguous German markers that don't rely on umlauts. Word-bounded.
const GERMAN_WORDS = [
  // function words
  "der", "die", "das", "und", "oder", "nicht", "wird", "werden", "ist", "sind",
  "ein", "eine", "einen", "einem", "einer", "kein", "keine", "dein", "deine", "deinen",
  "mit", "von", "vom", "zum", "zur", "auf", "aus", "im", "beim", "durch", "ohne",
  "mehr", "alle", "allen", "schon", "noch", "wenn", "dann", "hier", "wie", "was",
  "wer", "sowie", "bereits", "jetzt", "sofort", "bitte", "danke", "erst", "auch",
  "Erste", "Ersten", "Erstes", "Neue", "Neuen", "Neues",
  // German-only verbs (no umlaut → otherwise missed)
  "entfernen", "benennen", "kopieren", "hochladen", "auswählen", "festlegen",
  "ergänzen", "formulieren", "speichern", "hinzufügen", "löschen", "bearbeiten",
  "verschieben", "herunterladen", "teilen", "einladen", "anmelden", "abmelden",
  "registrieren", "unterschreiben", "freigeben", "absenden", "schreiben", "suchen",
  "stimmen", "vorbereiten", "erstellen", "vorbereitet", "gespeichert", "geliefert",
  // German-only nouns
  "Projekt", "Auftrag", "Vertrag", "Termin", "Freigabe", "Freigaben", "Eintrag",
  "Einträge", "Rolle", "Rollen", "Rollenlink", "Aufgabe", "Aufgaben", "Motiv",
  "Motive", "Frage", "Fragen", "Antwort", "Antworten", "Ergebnis", "Ergebnisse",
  "Auswahl", "Vorschlag", "Vorschläge", "Notiz", "Notizen", "Spalte", "Datei",
  "Dateien", "Ort", "Orte", "Bild", "Bilder", "Aufnahme", "Nutzer", "Konto",
  "Kunde", "Kunden", "Fotograf", "Anfrage", "Nachricht", "Übersicht", "Zurück",
  "Einstellungen", "Abbrechen", "Bearbeiten", "Punkt", "Stimme", "Vorschau",
];
const wordRe = new RegExp(`\\b(${GERMAN_WORDS.join("|")})\\b`, "i");
const umlautRe = /[äöüÄÖÜß]/;
const UI_FRAGMENTS = [
  "Baustein hinzufügen",
  "Eintrag hinzufügen",
  "Vollbild",
  "Hier unterschreiben",
  "Zurücksetzen",
  "Deine Projekte",
  "Speichern fehlgeschlagen",
  "Teilen fehlgeschlagen",
  "Anmelden / Account anlegen",
  "In Vorbereitung",
  "Projekttitel eingeben",
  "Kein Element gefunden",
  "Archiviert",
  "Abgeschlossen",
  "Entwurf",
  "Wiederherstellen",
  "Duplizieren",
  "Umbenennen",
  "Einladung senden",
  "Direkter Projektzugang",
  "Einladung ausstehend",
];
const fragmentRe = new RegExp(UI_FRAGMENTS.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"));

function* walk(path) {
  let st;
  try { st = statSync(path); } catch { return; }
  if (st.isFile()) { if (/\.(tsx?|mjs)$/.test(path) && !EXCLUDE_FILE(path)) yield path; return; }
  for (const name of readdirSync(path)) {
    if (EXCLUDE_DIRS.has(name)) continue;
    yield* walk(join(path, name));
  }
}

// Strip a leading comment line so English code comments never trip us (they
// shouldn't contain German anyway, but be safe).
function isCommentOnly(line) {
  const t = line.trim();
  return t.startsWith("//") || t.startsWith("*") || t.startsWith("/*");
}

function isTechnicalGermanIdentifier(line) {
  return line.includes("/vertrag") ||
    line.includes("/studio/konto") ||
    line.includes("/studio/vertragsinhalte") ||
    line.includes("s.id !== \"dienstleister\"") ||
    line.includes("s.id !== \"kunde\"");
}

const findings = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    const lines = readFileSync(file, "utf8").split("\n");
    lines.forEach((line, i) => {
      if (line.includes("i18n-ignore") || isCommentOnly(line) || isTechnicalGermanIdentifier(line)) return;
      // Only consider text that lives in a quote or JSX text node.
      const hasQuotedOrJsx = /["'`][^"'`]*[äöüÄÖÜß][^"'`]*["'`]|>[^<>{}]*[äöüÄÖÜß][^<>{}]*</.test(line)
        || (/["'`]/.test(line) && wordRe.test(line))
        || (/>[^<>{}]{3,}</.test(line) && wordRe.test(line))
        || ((/["'`]/.test(line) || />[^<>{}]{3,}</.test(line)) && fragmentRe.test(line));
      if (!hasQuotedOrJsx) return;
      if (!umlautRe.test(line) && !wordRe.test(line) && !fragmentRe.test(line)) return;
      findings.push({ file, line: i + 1, text: line.trim().slice(0, 100) });
    });
  }
}

const byFile = new Map();
for (const f of findings) byFile.set(f.file, (byFile.get(f.file) || 0) + 1);

if (findings.length === 0) {
  console.log("✅ i18n guard: no hardcoded German strings outside the dictionaries.");
  process.exit(0);
}

console.log(`❌ i18n guard: ${findings.length} hardcoded German string(s) in ${byFile.size} file(s):\n`);
for (const [file, n] of [...byFile.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(n).padStart(3)}  ${file}`);
}
if (process.argv.includes("--list")) {
  console.log("\n── detail ──");
  for (const f of findings) console.log(`${f.file}:${f.line}  ${f.text}`);
}
process.exit(1);
