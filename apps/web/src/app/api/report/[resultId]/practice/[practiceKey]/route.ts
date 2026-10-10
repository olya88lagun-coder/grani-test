import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { MAX_PRACTICE_REVISION } from "@/lib/money-practice";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { isSameOrigin } from "@/server/http";
import { currentUser } from "@/server/viewer";
import { moneyPracticeEnabled, readPractice, savePractice, type PracticeResponse } from "@/server/practice-service";

type Context = { params: Promise<{ resultId: string; practiceKey: string }> };
const reply = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
const status = (r: PracticeResponse) => r.ok ? 200 : { not_found: 404, access_required: 403, invalid: 400, conflict: 409, incompatible: 409 }[r.error];
const payloadSchema = z.strictObject({ expectedRevision: z.number().int().min(0).max(MAX_PRACTICE_REVISION), data: z.unknown() });
export async function GET(_request: NextRequest, { params }: Context) {
  if (!moneyPracticeEnabled()) return reply({ ok: false, error: "not_found" }, 404);
  const user = await currentUser(); if (!user) return reply({ ok: false, error: "unauthorized" }, 401);
  const { resultId, practiceKey } = await params;
  const result = await readPractice(getDb(), { userId: user.id, resultId, key: practiceKey });
  return reply(result, status(result));
}
export async function PUT(request: NextRequest, { params }: Context) {
  if (!moneyPracticeEnabled()) return reply({ ok: false, error: "not_found" }, 404);
  if (!isSameOrigin(request, getEnv().APP_URL)) return reply({ ok: false, error: "bad_origin" }, 403);
  const user = await currentUser(); if (!user) return reply({ ok: false, error: "unauthorized" }, 401);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return reply({ ok: false, error: "invalid" }, 400);
  const reader = request.body?.getReader(); if (!reader) return reply({ ok: false, error: "invalid" }, 400);
  let text = "", bytes = 0; const decoder = new TextDecoder();
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 128 * 1024) { await reader.cancel(); return reply({ ok: false, error: "too_large" }, 413); }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
  } catch { return reply({ ok: false, error: "invalid" }, 400); }
  let body: unknown; try { body = JSON.parse(text); } catch { return reply({ ok: false, error: "invalid" }, 400); }
  const parsed = payloadSchema.safeParse(body); if (!parsed.success) return reply({ ok: false, error: "invalid" }, 400);
  const { resultId, practiceKey } = await params;
  const result = await savePractice(getDb(), { userId: user.id, resultId, key: practiceKey, ...parsed.data });
  return reply(result, status(result));
}
