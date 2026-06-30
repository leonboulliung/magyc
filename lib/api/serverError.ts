import "server-only";

import { NextResponse } from "next/server";

/** Log operational detail server-side while returning a stable public code. */
export function apiServerError(code: string, context: string, error: unknown): NextResponse {
  const message = error instanceof Error
    ? error.message
    : typeof (error as { message?: unknown } | null)?.message === "string"
      ? String((error as { message: string }).message)
      : String(error);
  console.error(`[${context}]`, message);
  return NextResponse.json({ error: code }, { status: 500 });
}
