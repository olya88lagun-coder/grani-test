import { NextResponse, type NextRequest } from "next/server";
import { getEnv } from "@/server/env";
import { TOGETHER_COOKIE, togetherCookieOptions } from "@/server/http";
import { togetherEntryValue } from "@/server/together-return";

// Ссылка «Войти» на страницах «Вдвоём»: запоминает, куда вернуть человека после входа через VK ID, и ведёт на обычный вход.
// В cookie попадает только перечисление («space» или «invite:<токен>»), не адрес
export async function GET(request: NextRequest) {
  const env = getEnv();
  const entry = togetherEntryValue(request.nextUrl.searchParams.get("next"), request.nextUrl.searchParams.get("token"));
  const response = NextResponse.redirect(new URL("/login", env.APP_URL), 303);
  if (entry) response.cookies.set(TOGETHER_COOKIE, entry, togetherCookieOptions(env.APP_URL));
  return response;
}
