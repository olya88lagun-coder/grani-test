import type { NextRequest } from "next/server";
import { loginDeps } from "@/server/deps";
import { expiredCookieOptions, VK_STATE_COOKIE, vkStateCookieOptions } from "@/server/http";
import { loginResponse, readLoginCookies } from "@/server/login-response";
import { finishVkLogin } from "@/server/login-service";

export async function GET(request: NextRequest) {
  const deps = loginDeps();
  const q = request.nextUrl.searchParams;
  const outcome = await finishVkLogin(deps, {
    code: q.get("code"),
    deviceId: q.get("device_id"),
    state: q.get("state"),
    stateCookie: request.cookies.get(VK_STATE_COOKIE)?.value ?? null,
    cookies: readLoginCookies(request),
  });
  const response = loginResponse(deps.env, outcome);
  response.cookies.set(VK_STATE_COOKIE, "", expiredCookieOptions(vkStateCookieOptions(deps.env.APP_URL)));
  return response;
}
