"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Одна ссылка на /me для всех: вошедшего она ведёт к его результату, остальных — ко входу.
// Подпись уточняется после ответа /api/session; без JavaScript остаётся «Войти»
export function AccountLink({ className }: { className: string }) {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/session", { signal: controller.signal, cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<{ signedIn?: boolean }>) : null))
      .then((body) => setSignedIn(body?.signedIn === true))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);

  return (
    <Link className={className} href="/me">
      {signedIn ? "Мой профиль" : "Войти"}
    </Link>
  );
}
