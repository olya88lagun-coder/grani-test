import { NextResponse, type NextRequest } from "next/server";
import { loginDeps } from "@/server/deps";
import { VK_STATE_COOKIE, vkStateCookieOptions } from "@/server/http";
import { startVkLogin } from "@/server/login-service";
import { logVkStep } from "@/server/vk-login-log";

export async function GET(request: NextRequest) {
  const deps = loginDeps();
  logVkStep("start", request);
  const { redirectUrl, stateCookie } = await startVkLogin(deps);
  const response = NextResponse.redirect(redirectUrl, 303);
  response.cookies.set(VK_STATE_COOKIE, stateCookie, vkStateCookieOptions(deps.env.APP_URL));
  return response;
}
