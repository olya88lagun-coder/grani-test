import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/server/env";
import { isShareCode } from "@grani/db";
import { TOGETHER_COOKIE, TOGETHER_FROM_COOKIE, togetherCookieOptions, togetherFromCookieOptions } from "@/server/http";
import { togetherEntryValue } from "@/server/together-return";

// Ссылка «Войти» на страницах «Вдвоём»: запоминает, куда вернуть человека после входа через VK ID, и ведёт на обычный вход.
// В cookie попадает только перечисление («space» или «invite:<токен>»), не адрес; отдельно запоминается код пары, чья ссылка привела сюда
export async function GET(request: NextRequest) {
  const env = getEnv();
  const entry = togetherEntryValue(request.nextUrl.searchParams.get("next"), request.nextUrl.searchParams.get("token"));
  const response = NextResponse.redirect(new URL("/login", env.APP_URL), 303);
  if (entry) response.cookies.set(TOGETHER_COOKIE, entry, togetherCookieOptions(env.APP_URL));
  // Код пары-друзей запоминается только в правильном формате; существует ли такая пара, проверяется при создании пространства
  const from = request.nextUrl.searchParams.get("from");
  if (from !== null && isShareCode(from)) response.cookies.set(TOGETHER_FROM_COOKIE, from, togetherFromCookieOptions(env.APP_URL));
  return response;
}
