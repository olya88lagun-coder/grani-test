import { leavePair } from "@grani/db";
import { NextResponse, type NextRequest } from "next/server";
import { loginDeps } from "@/server/deps";
import { isSameOrigin, SESSION_COOKIE } from "@/server/http";
import { getCurrentUser } from "@/server/login-service";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const deps = loginDeps();
  if (!isSameOrigin(request, deps.env.APP_URL)) return NextResponse.json({ ok: false, error: "bad_origin" }, { status: 403 });
  const user = await getCurrentUser(deps, request.cookies.get(SESSION_COOKIE)?.value ?? null);
  if (!user) return NextResponse.redirect(new URL("/login", deps.env.APP_URL), 303);
  const { id } = await params;
  // Повторный выход или чужая пара — тот же переход: не выдаём, существует ли пара
  await leavePair(deps.db, id, user.id);
  return NextResponse.redirect(new URL("/me", deps.env.APP_URL), 303);
}
