import type { NextRequest } from "next/server";
import { loginDeps } from "@/server/deps";
import { loginResponse, readLoginCookies } from "@/server/login-response";
import { loginWithTelegram } from "@/server/login-service";

export async function GET(request: NextRequest) {
  const deps = loginDeps();
  const outcome = await loginWithTelegram(deps, request.nextUrl.searchParams, readLoginCookies(request));
  return loginResponse(deps.env, outcome);
}
