export const PROJECT_MODES = [
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

export type ProjectModeId = (typeof PROJECT_MODES)[number]["id"];

export type ProjectMode = (typeof PROJECT_MODES)[number];

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
