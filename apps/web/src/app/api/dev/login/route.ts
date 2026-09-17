import { NextResponse, type NextRequest } from "next/server";
import { loginDeps } from "@/server/deps";
import { isDevLoginEnabled } from "@/server/dev-login";
import { loginResponse, readLoginCookies } from "@/server/login-response";
import { completeLogin, giveConsent } from "@/server/login-service";

// Только для локальной разработки и E2E: Telegram-виджет не работает на localhost.
// Dev-вход считает согласие данным, иначе сквозной сценарий пришлось бы проходить через настоящий виджет.
export async function GET(request: NextRequest) {
  if (!isDevLoginEnabled(process.env)) return new NextResponse(null, { status: 404 });
  const deps = loginDeps();
  const name = request.nextUrl.searchParams.get("name") ?? "Разработчик";
  const cookies = { ...readLoginCookies(request), consent: await giveConsent(deps) };
  const outcome = await completeLogin(deps, { provider: "telegram", externalId: `dev-${name}`, displayName: name, gender: null }, cookies);
  return loginResponse(deps.env, outcome);
}
