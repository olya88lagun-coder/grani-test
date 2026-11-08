import { isInviteToken } from "@grani/db";
import { NextResponse, type NextRequest } from "next/server";
import { signShortPending } from "@/server/auth/tokens";
import { getDb } from "@/server/db";
import { getEnv } from "@/server/env";
import { isSameOrigin, SESSION_COOKIE, SHORT_PENDING_COOKIE, shortPendingCookieOptions } from "@/server/http";
import { getCurrentUser } from "@/server/login-service";
import { clientKeyFromHeaders, resultsLimiter } from "@/server/rate-limit";
import { getShortTest } from "@grani/content/short-tests";
import { parseShortAnswers, saveShortAnswers } from "@/server/short-results-service";

// Ответы короткого теста уходят на сервер только когда человек сам открывает платный разбор или зовёт партнёра.
// Вошедшему — сохраняем сразу; гостю — подписанная cookie на время входа, без записи в базу
export async function POST(request: NextRequest) {
  const env = getEnv();
  if (!isSameOrigin(request, env.APP_URL)) return NextResponse.json({ ok: false, error: "bad_origin" }, { status: 403 });
  if (!resultsLimiter.allow(clientKeyFromHeaders(request.headers))) return NextResponse.json({ ok: false, error: "rate_limited" }, { status: 429 });

  const body: unknown = await request.json().catch(() => null);
  const fields = typeof body === "object" && body !== null ? (body as { slug?: unknown; answers?: unknown; intent?: unknown; invite?: unknown }) : {};
  const test = typeof fields.slug === "string" ? getShortTest(fields.slug) : null;
  // Тест без платного разбора и режима пары не сохраняется: и гостю не выдаётся cookie с его ответами
  const parsed = test?.reportOffer || test?.pairOffer ? parseShortAnswers(test, fields.answers) : null;
  const intent = fields.intent === "pair" ? ("pair" as const) : undefined;
  const invite = typeof fields.invite === "string" && isInviteToken(fields.invite) ? fields.invite : undefined;
  if (!test || !parsed) return NextResponse.json({ ok: false, error: "invalid_answers" }, { status: 400 });

  const db = getDb();
  const user = await getCurrentUser({ db, env }, request.cookies.get(SESSION_COOKIE)?.value ?? null);
  if (user) {
    const saved = await saveShortAnswers({ db }, { userId: user.id, slug: test.slug, answers: parsed });
    if (!saved.ok) return NextResponse.json({ ok: false, error: "invalid_answers" }, { status: 400 });
    const redirect = invite ? `/sp/${invite}` : intent === "pair" ? `/short/${saved.id}#pair` : `/short/${saved.id}`;
    return NextResponse.json({ ok: true, redirect });
  }
  const response = NextResponse.json({ ok: true, redirect: "/login" });
  const pending = await signShortPending({ slug: test.slug, answers: { ...parsed }, intent, invite }, env.SESSION_SECRET);
  response.cookies.set(SHORT_PENDING_COOKIE, pending, shortPendingCookieOptions(env.APP_URL));
  return response;
}
