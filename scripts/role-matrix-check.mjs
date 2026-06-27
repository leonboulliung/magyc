const baseUrl = (process.env.MAGYC_BASE_URL || "https://www.magyc.site").replace(/\/$/, "");
const privateSpaceId = process.env.MAGYC_TEST_PRIVATE_SPACE_ID || "";
const sharedSpaceId = process.env.MAGYC_TEST_SHARED_SPACE_ID || "";
const tokens = {
  owner: process.env.MAGYC_TEST_OWNER_TOKEN || "",
  editor: process.env.MAGYC_TEST_EDITOR_TOKEN || "",
  client: process.env.MAGYC_TEST_CLIENT_TOKEN || "",
  stranger: process.env.MAGYC_TEST_STRANGER_TOKEN || "",
};

if (!privateSpaceId || !sharedSpaceId || !tokens.owner || !tokens.editor || !tokens.client) {
  process.stderr.write([
    "Missing role-matrix fixtures.",
    "Set MAGYC_TEST_PRIVATE_SPACE_ID, MAGYC_TEST_SHARED_SPACE_ID,",
    "MAGYC_TEST_OWNER_TOKEN, MAGYC_TEST_EDITOR_TOKEN, and MAGYC_TEST_CLIENT_TOKEN.",
    "Tokens are short-lived Clerk session tokens and are never printed.",
  ].join(" ") + "\n");
  process.exit(2);
}

const checks = [
  { name: "owner reads private project", id: privateSpaceId, token: tokens.owner, expected: 200 },
  { name: "editor reads private project", id: privateSpaceId, token: tokens.editor, expected: 200 },
  { name: "client reads private project", id: privateSpaceId, token: tokens.client, expected: 200 },
  { name: "signed-out visitor cannot read private project", id: privateSpaceId, token: "", expected: 404 },
  { name: "signed-out visitor reads shared project", id: sharedSpaceId, token: "", expected: 200 },
];
if (tokens.stranger) {
  checks.push({
    name: "unassigned account cannot read private project",
    id: privateSpaceId,
    token: tokens.stranger,
    expected: 404,
  });
}

let failed = false;
for (const check of checks) {
  const response = await fetch(`${baseUrl}/api/spaces/${encodeURIComponent(check.id)}`, {
    headers: check.token ? { authorization: `Bearer ${check.token}` } : undefined,
    cache: "no-store",
  });
  const ok = response.status === check.expected;
  process.stdout.write(`${ok ? "PASS" : "FAIL"} ${check.name}: ${response.status} (expected ${check.expected})\n`);
  if (!ok) failed = true;
}

if (failed) process.exitCode = 1;
