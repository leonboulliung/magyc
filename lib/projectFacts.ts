import type { Module, ModuleStateEntry } from "./types";

export interface ProjectFactShot {
  label: string;
  purpose?: string;
  setup?: string;
  location?: string;
  priority?: string;
  status?: string;
}

export interface ProjectFactItem {
  label: string;
  details?: string;
  quantity?: string;
  format?: string;
  due?: string;
  status?: string;
}

export interface ProjectFacts {
  title: string;
  description: string;
  tags: string[];
  dates: string[];
  locations: string[];
  deliverables: ProjectFactItem[];
  crew: string[];
  workPackages: string[];
  shots: ProjectFactShot[];
  moodboard: { label: string; note?: string; status?: string }[];
  approvals: { label: string; due?: string; status?: string; approved: boolean }[];
  checklist: { label: string; checked: boolean }[];
  uploads: { name: string; mimeType?: string; size?: number; moduleType?: string }[];
  selectedUploads: string[];
  questions: { question: string; answers: string[] }[];
  notes: string[];
  parts: { name: string; quantity?: string; imageUrl?: string }[];
  polls: { question: string; options: { label: string; votes: number }[] }[];
}

const clean = (value: unknown, max = 240): string =>
  typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, max) : "";

const uniq = (values: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.toLocaleLowerCase("de-DE");
    if (!value || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hasTime = /\d{2}:\d{2}/.test(iso);
  return d.toLocaleString("de-DE", hasTime ? { dateStyle: "long", timeStyle: "short" } : { dateStyle: "long" });
}

function stateFor(state: ModuleStateEntry[], moduleIndex: number): ModuleStateEntry[] {
  return state
    .filter((entry) => entry.moduleIndex === moduleIndex)
    .sort((a, b) => a.createdAt - b.createdAt);
}

function liveAdds(state: ModuleStateEntry[], moduleIndex: number): ModuleStateEntry[] {
  const deleted = new Set<string>();
  for (const entry of stateFor(state, moduleIndex)) {
    if (entry.kind === "edit" && entry.data.deleted === true && typeof entry.data.id === "string") {
      deleted.add(entry.data.id);
    }
  }
  return stateFor(state, moduleIndex)
    .filter((entry) => entry.kind === "add")
    .filter((entry) => !deleted.has(typeof entry.data.id === "string" ? entry.data.id : entry.id));
}

function liveUploads(state: ModuleStateEntry[], moduleIndex: number): ModuleStateEntry[] {
  const entries = stateFor(state, moduleIndex);
  const deleted = new Set(entries
    .filter((entry) => entry.kind === "edit" && entry.data.deleted === true)
    .map((entry) => clean(entry.data.id, 120))
    .filter(Boolean));
  return entries.filter((entry) => entry.kind === "upload" && !deleted.has(entry.id));
}

function itemChecked(state: ModuleStateEntry[], moduleIndex: number, itemKey: string): boolean {
  const checks = stateFor(state, moduleIndex)
    .filter((entry) => entry.kind === "check" && entry.data.itemKey === itemKey);
  return checks.some((entry) => entry.data.checked === true);
}

function applyEdits<T extends { id: string }>(
  items: T[],
  state: ModuleStateEntry[],
  moduleIndex: number,
  apply: (item: T, data: Record<string, unknown>) => T,
): T[] {
  const byId = new Map(items.map((item) => [item.id, item]));
  for (const entry of stateFor(state, moduleIndex)) {
    if (entry.kind !== "edit") continue;
    const id = clean(entry.data.id, 120);
    if (!id || !byId.has(id)) continue;
    if (entry.data.deleted === true) {
      byId.delete(id);
      continue;
    }
    byId.set(id, apply(byId.get(id) as T, entry.data));
  }
  return [...byId.values()];
}

function moduleTitle(module: Module): string {
  return clean(module.microTitle || module.description || module.type, 80);
}

export function buildProjectFacts(modules: Module[], state: ModuleStateEntry[] = []): ProjectFacts {
  const facts: ProjectFacts = {
    title: "",
    description: "",
    tags: [],
    dates: [],
    locations: [],
    deliverables: [],
    crew: [],
    workPackages: [],
    shots: [],
    moodboard: [],
    approvals: [],
    checklist: [],
    uploads: [],
    selectedUploads: [],
    questions: [],
    notes: [],
    parts: [],
    polls: [],
  };

  modules.forEach((module, moduleIndex) => {
    const entries = stateFor(state, moduleIndex);
    switch (module.type) {
      case "heading":
        if (!facts.title) facts.title = clean(module.text, 180);
        break;
      case "rich_text":
        if (!facts.description) facts.description = clean(module.text, 1200);
        break;
      case "tags":
        facts.tags.push(...module.tags.map((tag) => clean(tag, 80)).filter(Boolean));
        break;
      case "date":
        if (module.date) facts.dates.push(fmtDate(module.date));
        break;
      case "appointment":
        if (module.datetime) facts.dates.push(fmtDate(module.datetime));
        break;
      case "appointments":
        for (const entry of module.entries) {
          if (entry.datetime) facts.dates.push([clean(entry.label, 80), fmtDate(entry.datetime)].filter(Boolean).join(": "));
        }
        break;
      case "range":
        if (module.from || module.to) facts.dates.push([module.from, module.to].map((v) => clean(v, 80)).filter(Boolean).join(" - "));
        break;
      case "location_single":
        facts.locations.push(clean(module.label, 180));
        break;
      case "locations_multi":
        facts.locations.push(...module.locations.map((location) => clean(location.label, 180)));
        break;
      case "location_suggestions":
        // Suggestions are deliberately unconfirmed. They must not become a
        // contractual shooting location until represented by the Orte element.
        break;
      case "route":
        facts.locations.push(...module.stops.map((stop) => clean(stop.label, 180)));
        break;
      case "crew":
        facts.crew.push(...module.roles.map((role) => clean(role.name, 120)));
        for (const entry of entries.filter((item) => item.kind === "claim")) {
          const slot = clean(entry.data.slotLabel, 120);
          const name = clean(entry.actor.displayName || entry.actor.id, 80);
          if (slot && name) facts.crew.push(`${slot}: ${name}`);
        }
        break;
      case "work_packages":
        facts.workPackages.push(...module.packages.map((pack) => [clean(pack.label, 120), clean(pack.description, 220)].filter(Boolean).join(" - ")));
        break;
      case "deliverables": {
        const seeded = module.items.map((item, index) => ({
          id: `seed-${index}`,
          label: clean(item.label, 160),
          details: clean(item.details, 300) || undefined,
          quantity: clean(item.quantity, 80) || undefined,
          format: clean(item.format, 80) || undefined,
          due: clean(item.due, 80) || undefined,
          status: clean(item.status, 40) || undefined,
        })).filter((item) => item.label);
        const added = liveAdds(state, moduleIndex).map((entry) => ({
          id: clean(entry.data.id, 120) || entry.id,
          label: clean(entry.data.label, 160),
          details: clean(entry.data.details, 300) || undefined,
          quantity: clean(entry.data.quantity, 80) || undefined,
          format: clean(entry.data.format, 80) || undefined,
          due: clean(entry.data.due, 80) || undefined,
          status: clean(entry.data.status, 40) || undefined,
        })).filter((item) => item.label);
        const items = applyEdits([...seeded, ...added], state, moduleIndex, (item, data) => ({
          ...item,
          label: typeof data.label === "string" ? clean(data.label, 160) : item.label,
          details: typeof data.details === "string" ? clean(data.details, 300) || undefined : item.details,
          quantity: typeof data.quantity === "string" ? clean(data.quantity, 80) || undefined : item.quantity,
          format: typeof data.format === "string" ? clean(data.format, 80) || undefined : item.format,
          due: typeof data.due === "string" ? clean(data.due, 80) || undefined : item.due,
          status: typeof data.status === "string" ? clean(data.status, 40) || undefined : item.status,
        }));
        facts.deliverables.push(...items.map(({ id: _id, ...item }) => item));
        break;
      }
      case "approvals": {
        const seeded = module.items.map((item, index) => ({
          id: `seed-${index}`,
          label: clean(item.text, 160),
          due: clean(item.due, 80) || undefined,
          status: clean(item.status, 40) || undefined,
          approved: item.status === "approved" || itemChecked(state, moduleIndex, `seed-${index}`),
        })).filter((item) => item.label);
        const added = liveAdds(state, moduleIndex).map((entry) => {
          const id = clean(entry.data.id, 120) || entry.id;
          return {
            id,
            label: clean(entry.data.text, 160),
            due: clean(entry.data.due, 80) || undefined,
            status: clean(entry.data.status, 40) || undefined,
            approved: itemChecked(state, moduleIndex, id),
          };
        }).filter((item) => item.label);
        const items = applyEdits([...seeded, ...added], state, moduleIndex, (item, data) => ({
          ...item,
          label: clean(data.text, 160) || item.label,
          due: typeof data.due === "string" ? clean(data.due, 80) || undefined : item.due,
          status: clean(data.status, 40) || item.status,
        }));
        facts.approvals.push(...items.map(({ id: _id, ...item }) => item));
        break;
      }
      case "checklist": {
        const seeded = module.items.map((item, index) => ({
          id: `seed-${index}`,
          label: clean(item.text, 160),
          checked: itemChecked(state, moduleIndex, `seed-${index}`),
        })).filter((item) => item.label);
        const added = liveAdds(state, moduleIndex).map((entry) => {
          const id = clean(entry.data.id, 120) || entry.id;
          return {
            id,
            label: clean(entry.data.text, 160),
            checked: itemChecked(state, moduleIndex, id),
          };
        }).filter((item) => item.label);
        facts.checklist.push(...[...seeded, ...added].map(({ id: _id, ...item }) => item));
        break;
      }
      case "moodboard": {
        const seeded = module.directions.map((direction, index) => ({
          id: `seed-${index}`,
          label: clean(direction.label, 160),
          note: clean(direction.note, 300) || undefined,
          status: clean(direction.status, 40) || "reference",
        })).filter((direction) => direction.label);
        const added = liveAdds(state, moduleIndex).map((entry) => ({
          id: clean(entry.data.id, 120) || entry.id,
          label: clean(entry.data.label, 160),
          note: clean(entry.data.note, 300) || undefined,
          status: clean(entry.data.status, 40) || "reference",
        })).filter((direction) => direction.label);
        const directions = applyEdits([...seeded, ...added], state, moduleIndex, (direction, data) => ({
          ...direction,
          label: clean(data.label, 160) || direction.label,
          note: typeof data.note === "string" ? clean(data.note, 300) || undefined : direction.note,
          status: clean(data.status, 40) || direction.status,
        }));
        facts.moodboard.push(...directions.map(({ id: _id, ...direction }) => direction));
        facts.uploads.push(...liveUploads(state, moduleIndex).map((entry) => ({
          name: clean(entry.data.name, 220) || "Bild",
          mimeType: clean(entry.data.mimeType, 120) || undefined,
          size: typeof entry.data.size === "number" ? entry.data.size : undefined,
          moduleType: module.type,
        })));
        break;
      }
      case "shot_list": {
        const seeded = module.shots.map((shot, index) => ({
          id: `seed-${index}`,
          label: clean(shot.label, 160),
          purpose: clean(shot.purpose, 220) || undefined,
          setup: clean(shot.setup, 160) || undefined,
          location: clean(shot.location, 160) || undefined,
          priority: clean(shot.priority, 40) || undefined,
          status: clean(shot.status, 40) || undefined,
        })).filter((shot) => shot.label);
        const added = liveAdds(state, moduleIndex).map((entry) => ({
          id: clean(entry.data.id, 120) || entry.id,
          label: clean(entry.data.label, 160),
          purpose: clean(entry.data.purpose, 220) || undefined,
          setup: clean(entry.data.setup, 160) || undefined,
          location: clean(entry.data.location, 160) || undefined,
          priority: clean(entry.data.priority, 40) || undefined,
          status: clean(entry.data.status, 40) || undefined,
        })).filter((shot) => shot.label);
        const shots = applyEdits([...seeded, ...added], state, moduleIndex, (shot, data) => ({
          ...shot,
          label: clean(data.label, 160) || shot.label,
          purpose: typeof data.purpose === "string" ? clean(data.purpose, 220) || undefined : shot.purpose,
          setup: typeof data.setup === "string" ? clean(data.setup, 160) || undefined : shot.setup,
          location: typeof data.location === "string" ? clean(data.location, 160) || undefined : shot.location,
          priority: clean(data.priority, 40) || shot.priority,
          status: clean(data.status, 40) || shot.status,
        }));
        facts.shots.push(...shots.map(({ id: _id, ...shot }) => shot));
        break;
      }
      case "parts_list": {
        const seeded = module.items.map((item, index) => ({
          id: `seed-${index}`,
          name: clean(item.name, 140),
          quantity: clean(item.quantity, 80) || undefined,
          imageUrl: clean(item.imageUrl, 600) || undefined,
        })).filter((item) => item.name);
        const added = liveAdds(state, moduleIndex).map((entry) => ({
          id: clean(entry.data.id, 120) || entry.id,
          name: clean(entry.data.name, 140),
          quantity: clean(entry.data.quantity, 80) || undefined,
          imageUrl: clean(entry.data.imageUrl, 600) || undefined,
        })).filter((item) => item.name);
        const items = applyEdits([...seeded, ...added], state, moduleIndex, (item, data) => ({
          ...item,
          name: typeof data.name === "string" ? clean(data.name, 140) || item.name : item.name,
          quantity: typeof data.quantity === "string" ? clean(data.quantity, 80) || undefined : item.quantity,
          imageUrl: typeof data.imageUrl === "string" ? clean(data.imageUrl, 600) || undefined : item.imageUrl,
        }));
        facts.parts.push(...items.map(({ id: _id, ...item }) => item));
        break;
      }
      case "notes": {
        const notes = applyEdits(
          liveAdds(state, moduleIndex).map((entry) => ({
            id: clean(entry.data.id, 120) || entry.id,
            text: clean(entry.data.text, 500),
          })).filter((entry) => entry.text),
          state,
          moduleIndex,
          (note, data) => ({
            ...note,
            text: typeof data.text === "string" ? clean(data.text, 500) : note.text,
          }),
        );
        facts.notes.push(...notes.map((note) => note.text).filter(Boolean));
        break;
      }
      case "qa": {
        const deleted = new Set(entries.filter((entry) => entry.kind === "edit" && entry.data.deleted === true).map((entry) => clean(entry.data.id, 120)));
        const questions = [
          ...(module.questions || []).map((question, index) => ({ id: `seed-${index}`, question: clean(question.text, 240), answers: [] as string[] })),
          ...entries
            .filter((entry) => entry.kind === "voice" && entry.data.role === "question")
            .map((entry) => ({ id: clean(entry.data.id, 120) || entry.id, question: clean(entry.data.text, 240), answers: [] as string[] })),
        ].filter((question) => question.question && !deleted.has(question.id));
        for (const entry of entries.filter((item) => item.kind === "voice" && item.data.role === "answer")) {
          const parentId = clean(entry.data.parentId, 120);
          const question = questions.find((item) => item.id === parentId);
          const answer = clean(entry.data.text, 500);
          if (question && answer) question.answers.push(answer);
        }
        facts.questions.push(...questions.map(({ id: _id, ...question }) => question));
        break;
      }
      case "poll": {
        const votes = new Map<string, number>();
        const latestByActor = new Map<string, ModuleStateEntry>();
        for (const entry of entries.filter((item) => item.kind === "vote")) {
          latestByActor.set(entry.actor.id, entry);
        }
        for (const entry of latestByActor.values()) {
          const option = clean(entry.data.option, 160);
          if (option) votes.set(option, (votes.get(option) || 0) + 1);
        }
        const question = clean(module.question, 240);
        const options = module.options.map((option) => ({
            label: clean(option, 160),
            votes: votes.get(option) || 0,
          })).filter((option) => option.label);
        if (question || options.length) facts.polls.push({ question, options });
        break;
      }
      case "attachments":
      case "images":
      case "audio":
      case "selection":
        facts.uploads.push(...liveUploads(state, moduleIndex).map((entry) => ({
          name: clean(entry.data.name, 220) || "Datei",
          mimeType: clean(entry.data.mimeType, 120) || undefined,
          size: typeof entry.data.size === "number" ? entry.data.size : undefined,
          moduleType: module.type,
        })));
        if (module.type === "selection") {
          for (const entry of entries.filter((item) => item.kind === "check" && item.data.checked === true)) {
            const itemKey = clean(entry.data.itemKey, 120);
            if (itemKey) facts.selectedUploads.push(itemKey);
          }
        }
        break;
      default:
        if (!facts.description && module.description) facts.description = clean(module.description, 1200);
        if (module.microTitle) {
          const title = moduleTitle(module);
          if (title && !facts.tags.includes(title)) facts.tags.push(title);
        }
        break;
    }
  });

  facts.tags = uniq(facts.tags);
  facts.dates = uniq(facts.dates);
  facts.locations = uniq(facts.locations);
  facts.crew = uniq(facts.crew);
  facts.workPackages = uniq(facts.workPackages);
  facts.selectedUploads = uniq(facts.selectedUploads);

  return facts;
}
