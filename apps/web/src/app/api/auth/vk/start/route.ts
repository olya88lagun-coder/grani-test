import { NextResponse } from "next/server";
import { loginDeps } from "@/server/deps";
import { VK_STATE_COOKIE, vkStateCookieOptions } from "@/server/http";
import { startVkLogin } from "@/server/login-service";

export async function GET() {
  const deps = loginDeps();
  const { redirectUrl, stateCookie } = await startVkLogin(deps);
  const response = NextResponse.redirect(redirectUrl, 303);
  response.cookies.set(VK_STATE_COOKIE, stateCookie, vkStateCookieOptions(deps.env.APP_URL));
  return response;
}
