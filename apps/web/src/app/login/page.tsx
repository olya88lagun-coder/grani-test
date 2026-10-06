import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { loginErrorMessage } from "@/lib/login-errors";
import { PENDING_COOKIE } from "@/server/http";
import { currentUser } from "@/server/viewer";
import { InAppBrowserNotice } from "@/components/InAppBrowserNotice";
import { LoginPanel } from "./LoginPanel";

export const metadata: Metadata = { title: "Вход" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const [{ error }, user, store] = await Promise.all([searchParams, currentUser(), cookies()]);
  if (user) redirect("/me");
  const message = loginErrorMessage(error ?? null);
  return (
    <main className="page stack inner-text">
      <p className="eyebrow">Грани</p>
      <h1 className="display">Вход</h1>
      {message && (
        <p className="error" role="alert">
          {message}
        </p>
      )}
      <InAppBrowserNotice place="login" hasPendingResult={store.has(PENDING_COOKIE)} />
      <div className="card">
        <LoginPanel hasPendingResult={store.has(PENDING_COOKIE)} />
      </div>
      <InAppBrowserNotice place="login-fallback" hasPendingResult={store.has(PENDING_COOKIE)} />
    </main>
  );
}
