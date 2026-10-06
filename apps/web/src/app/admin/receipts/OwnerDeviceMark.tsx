"use client";

import { useEffect } from "react";
import { markOwnerDevice } from "@/lib/analytics";

// Страница чеков открывается только владелице — значит, это её устройство, и Метрика на нём больше не загружается
export function OwnerDeviceMark() {
  useEffect(() => markOwnerDevice(window.localStorage), []);
  return <p className="muted">На этом устройстве твои визиты не попадают в Метрику. Открой эту страницу один раз на каждом своём телефоне и компьютере.</p>;
}
