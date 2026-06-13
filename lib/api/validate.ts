import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Request-body validation at the API trust boundary.
 *
 * Scope discipline: these schemas validate STRUCTURE and apply pure
 * cleaning (trim / slice / clamp) on scalars only. Rich objects
 * (`widget`, `modules`, `style`, `answers`, …) stay
 * `z.unknown().optional()` and flow UNCHANGED into the existing
 * sanitizers (sanitizeModule, …) which remain the single authority on
 * those shapes. Zod v4 gotcha: a bare `z.unknown()` object field is
 * REQUIRED — a missing key fails the whole parse with a generic
 * "Invalid input"; always add `.optional()` and let the route's own
 * check produce the specific error. Authorization (token matching,
 * Clerk session) stays in each route — a short/empty token is an auth
 * failure (403/401), never a body-validation error.
 *
 * `parseBody` tolerates a missing/empty body (→ {}), so routes whose
 * fields are all optional keep working when called with no payload.
 */
export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

export async function parseBody<T extends z.ZodTypeAny>(
  req: Request,
  schema: T,
): Promise<ParseResult<z.infer<T>>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    raw = undefined;
  }
  const result = schema.safeParse(raw === undefined ? {} : raw);
  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "invalid_body", detail: result.error.issues[0]?.message ?? "bad request" },
        { status: 400 },
      ),
    };
  }
  return { ok: true, data: result.data };
}
