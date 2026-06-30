const baseUrl = (process.env.MAGYC_BASE_URL || "https://www.magyc.site").replace(/\/$/, "");

const checks = [
  {
    name: "homepage and security headers",
    path: "/",
    method: "GET",
    expected: 200,
    expectedHeaders: {
      "x-frame-options": "DENY",
      "x-content-type-options": "nosniff",
    },
  },
  { name: "photography marketing route", path: "/product", method: "GET", expected: 200 },
  { name: "native sign-in route", path: "/sign-in", method: "GET", expected: 200 },
  { name: "internal showroom disabled", path: "/dev", method: "GET", expected: 404 },
  { name: "retired GIF proxy disabled", path: "/api/gif?q=test", method: "GET", expected: 404 },
  {
    name: "project auth gate",
    path: "/api/projects/smoke-check",
    method: "PATCH",
    body: {},
    expected: 401,
    expectedError: "unauthorized",
  },
  {
    name: "state auth gate",
    path: "/api/spaces/smoke-check/state",
    method: "POST",
    body: { moduleIndex: 0, kind: "add", data: { text: "smoke-check" } },
    expected: 401,
    expectedError: "anon_token_required",
  },
  {
    name: "private snapshot concealment",
    path: "/api/spaces/smoke-check",
    method: "GET",
    expected: 404,
    expectedError: "not_found",
  },
  {
    name: "admin auth gate",
    path: "/api/admin/users/smoke-check",
    method: "PATCH",
    body: {},
    expected: 401,
    expectedError: "signed_out",
  },
];

let failed = false;
for (const check of checks) {
  const response = await fetch(`${baseUrl}${check.path}`, {
    method: check.method,
    headers: check.body ? { "content-type": "application/json" } : undefined,
    body: check.body ? JSON.stringify(check.body) : undefined,
    redirect: "manual",
  });
  const text = await response.text();
  let error = "";
  try { error = JSON.parse(text)?.error || ""; } catch { /* non-JSON page */ }
  const ok = response.status === check.expected
    && (!check.expectedError || error === check.expectedError)
    && (!check.expectedHeaders || Object.entries(check.expectedHeaders).every(
      ([name, value]) => response.headers.get(name) === value,
    ));
  const expected = check.expectedError
    ? `${check.expected}/${check.expectedError}`
    : String(check.expected);
  const actual = error ? `${response.status}/${error}` : String(response.status);
  process.stdout.write(`${ok ? "PASS" : "FAIL"} ${check.name}: ${actual} (expected ${expected})\n`);
  if (!ok) failed = true;
}

if (failed) process.exitCode = 1;
