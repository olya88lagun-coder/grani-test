import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/server/http";
import { currentUser } from "@/server/viewer";
import { getDb } from "@/server/db";
import { getYearProfile, type YearProfile } from "@/server/new-year-profile";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };

export async function GET() {
  // Guests do not need a database or configured VK credentials to use the reflection.
  if (!(await cookies()).get(SESSION_COOKIE)?.value) return Response.json({ status: "guest" }, { headers });
  try {
    const user = await currentUser();
    const profile: YearProfile = user ? await getYearProfile(getDb(), user.id) : { status: "guest" };
    return Response.json(profile, { headers });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers });
  }
}
