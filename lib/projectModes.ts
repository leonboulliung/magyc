import type { ModuleType } from "./types";

type AssistChip = { label: string; text: string };
type ScoreBias = Partial<Record<ModuleType, number>>;
type ShapeHints = Partial<Record<ModuleType, string>>;

export interface ProjectMode {
  id: ProjectModeId;
  label: string;
  composerHint: string;
  placeholder: string;
  examples: string[];
  assistChips: AssistChip[];
  authoringGuide?: string;
  scoreBias?: ScoreBias;
  shapeHints?: ShapeHints;
}

export type ProjectModeId =
  | "photo_shoot"
  | "event"
  | "trip"
  | "campaign"
  | "workshop";

export const PROJECT_MODES: readonly ProjectMode[] = [
  {
    id: "photo_shoot",
    label: "Photo shoot",
    composerHint:
      "Shape this as a shoot workspace: concept, mood/reference direction, locations, crew, shot list, schedule, prep checklist, deliverables, and client questions.",
    placeholder: "Plan a brand photo shoot, portrait session, campaign shoot, or editorial idea.",
    examples: [
      "Plan a brand photo shoot for a yoga teacher in Berlin.",
      "Structure a cinematic night shoot around South Bank and Brick Lane.",
      "Create a product shoot plan for a handmade ceramics launch.",
    ],
    assistChips: [
      { label: "Add locations?", text: "Locations are still open and should be suggested." },
      { label: "Need roles?", text: "Include crew roles and who should confirm them." },
      { label: "Want a shot list?", text: "Turn the idea into a practical shot list." },
      { label: "Add deliverables?", text: "Include final deliverables and approval points." },
    ],
    authoringGuide:
      "Prefer a practical shoot workspace over generic brainstorming. Use images as references or moodboard slots, table as a shot list, checklist as prep, crew as confirmable roles, deliverables for concrete outputs, approvals for sign-off moments, parts_list as props / looks / gear, attachments as brief or call-sheet support, and qa for client questions. When something is not confirmed, phrase it as a proposal, checklist item, deliverable expectation, approval step, or open question rather than a fact.",
    scoreBias: {
      ai_summary: 1,
      location_suggestions: 1,
      appointment: 1,
      appointments: 1,
      range: 1,
      crew: 2,
      checklist: 3,
      deliverables: 4,
      approvals: 2,
      qa: 2,
      table: 4,
      parts_list: 2,
      attachments: 2,
      images: 4,
      sketch: 1,
      notes: -2,
      discussion: -2,
    },
    shapeHints: {
      images:
        `{"type":"images","microTitle":"<e.g. References>","description":"<1 short line inviting visual references or moodboard uploads>","placeholder":"<brief upload cue like 'Upload references, lighting, styling, or location ideas.'>"}`,
      checklist:
        `{"type":"checklist","microTitle":"<e.g. Prep>","description":"<1 short line about what must be ready before the shoot>","items":[{"text":"Confirm final looks or products"},{"text":"Align on location details and timing"},{"text":"Prepare props, wardrobe, or brand materials"}]}`,
      crew:
        `{"type":"crew","microTitle":"<e.g. Roles>","description":"<1 short line about who needs to confirm involvement>","roles":[{"name":"Photographer"},{"name":"Subject / Talent"},{"name":"Stylist / Assistant"}]}`,
      deliverables:
        `{"type":"deliverables","microTitle":"<e.g. Deliverables>","description":"<1 short line about what should exist after the shoot>","items":[{"label":"Hero selection","quantity":"8-12 images","format":"Edited JPG","due":"<if known>"},{"label":"Detail / process set","quantity":"10-20 images","format":"Web + social crops"}]}`,
      approvals:
        `{"type":"approvals","microTitle":"<e.g. Approvals>","description":"<1 short line about what needs sign-off>","items":[{"text":"Moodboard and visual direction"},{"text":"Final shot list or priorities"},{"text":"Final image selection"}]}`,
      qa:
        `{"type":"qa","microTitle":"<e.g. Client questions>","description":"<1 short line about clarifying remaining client decisions>","placeholder":"<brief cue like 'Add open questions, missing details, or client notes.'>","questions":[{"text":"What must these images achieve?"},{"text":"Which usage rights or channels matter most?"},{"text":"What still feels open before we lock the plan?"}]}`,
      table:
        `{"type":"table","microTitle":"<e.g. Shot list>","description":"<1 short line explaining what the team should align on>","columns":["Shot","Purpose","Location","Notes"],"rows":[["Hero portrait","Website / campaign","Main setup","Natural light, direct eye contact"],["Hands / process detail","Supporting asset","Work table","Tighter crop or detail frame"]]}`,
      parts_list:
        `{"type":"parts_list","microTitle":"<e.g. Props & looks>","description":"<1 short line about what needs to be brought or prepared>","items":[{"name":"Hero look / outfit","quantity":"1-2 options"},{"name":"Key prop or product","quantity":"Final version ready"},{"name":"Brand material / packaging","quantity":"If needed on set"}]}`,
      attachments:
        `{"type":"attachments","microTitle":"<e.g. Brief & files>","description":"<1 short line inviting supporting documents>","placeholder":"<brief upload cue like 'Upload brand brief, call sheet, contracts, or usage notes.'>"}`,
      sketch:
        `{"type":"sketch","microTitle":"<e.g. Setup sketch>","description":"<1 short line about lighting, framing, or floor-plan ideas>","placeholder":"<brief cue like 'Sketch framing, lighting, or set layout here.'>"}`,
    },
  },
  {
    id: "event",
    label: "Event",
    composerHint:
      "Shape this as an event workspace: purpose, attendees, venue, timeline, roles, tasks, decisions, materials, and follow-up.",
    placeholder: "Plan a dinner, reunion, opening, community night, or private gathering.",
    examples: [
      "Organize a class reunion for 35 people in Hamburg.",
      "Plan a small gallery opening with drinks and a short artist talk.",
      "Create a birthday dinner plan with venue options and tasks.",
    ],
    assistChips: [
      { label: "Add timeline?", text: "Include a clear event timeline." },
      { label: "Need roles?", text: "Add roles for hosts, setup, guests, and follow-up." },
      { label: "Add venue?", text: "Suggest what kind of venue would fit." },
    ],
  },
  {
    id: "trip",
    label: "Trip",
    composerHint:
      "Shape this as a trip workspace: route, dates or time span, places, activities, logistics, budget, packing, and decisions.",
    placeholder: "Plan a weekend trip, route, group journey, retreat, or research visit.",
    examples: [
      "Plan a slow weekend trip to Copenhagen with design shops and food stops.",
      "Organize a three-day road trip through northern Italy.",
      "Create a retreat plan for six friends near the sea.",
    ],
    assistChips: [
      { label: "Add route?", text: "Include a route and travel sequence." },
      { label: "Need budget?", text: "Include a rough budget structure." },
      { label: "Add places?", text: "Suggest places and stops to decide between." },
    ],
  },
  {
    id: "campaign",
    label: "Campaign",
    composerHint:
      "Shape this as a campaign workspace: audience, message, channels, assets, milestones, tasks, approvals, and deliverables.",
    placeholder: "Plan a launch campaign, content push, local promotion, or brand idea.",
    examples: [
      "Create a launch plan for a neighborhood cafe.",
      "Plan a small campaign for a new fashion capsule.",
      "Structure a content campaign for a podcast season.",
    ],
    assistChips: [
      { label: "Add channels?", text: "Include channels and campaign touchpoints." },
      { label: "Need assets?", text: "List the assets and deliverables needed." },
      { label: "Add milestones?", text: "Turn this into milestones and tasks." },
    ],
  },
  {
    id: "workshop",
    label: "Workshop",
    composerHint:
      "Shape this as a workshop workspace: learning goal, audience, agenda, materials, facilitation roles, exercises, and follow-up.",
    placeholder: "Plan a workshop, seminar, creative session, class, or team format.",
    examples: [
      "Plan a two-hour workshop about turning ideas into small experiments.",
      "Create a photography basics workshop for beginners.",
      "Organize a team session for defining a product direction.",
    ],
    assistChips: [
      { label: "Add agenda?", text: "Include a timed workshop agenda." },
      { label: "Need materials?", text: "List materials and preparation steps." },
      { label: "Add exercises?", text: "Suggest practical exercises for participants." },
    ],
  },
] as const;

export function projectModeById(id: unknown): ProjectMode | null {
  if (typeof id !== "string") return null;
  return PROJECT_MODES.find((mode) => mode.id === id) ?? null;
}

export function projectContextLines(id: unknown): string[] {
  const mode = projectModeById(id);
  if (!mode) return [];
  return [
    `- Selected project type: ${mode.label}`,
    `- Planning focus: ${mode.composerHint}`,
  ];
}

export function projectModeAuthoringGuide(id: unknown): string | null {
  return projectModeById(id)?.authoringGuide ?? null;
}

export function projectModeScoreBias(id: unknown): ScoreBias {
  return projectModeById(id)?.scoreBias ?? {};
}

export function projectModeShapeHints(id: unknown): ShapeHints {
  return projectModeById(id)?.shapeHints ?? {};
}
