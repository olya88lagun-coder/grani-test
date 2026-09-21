"use client";

import { useEffect, useId } from "react";

type VkWidgets = { Widgets: { AllowMessagesFromCommunity(elementId: string, options: { height: number }, groupId: number): void } };

const OPENAPI_SRC = "https://vk.com/js/api/openapi.js?169";

export function VkAllowMessages({ groupId }: { groupId: string }) {
  const elementId = `vk-allow-${useId().replace(/:/g, "")}`;

  useEffect(() => {
    const render = () => (window as unknown as { VK?: VkWidgets }).VK?.Widgets.AllowMessagesFromCommunity(elementId, { height: 30 }, Number(groupId));
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${OPENAPI_SRC}"]`);
    if (existing) {
      render();
      return;
    }
    const script = document.createElement("script");
    script.src = OPENAPI_SRC;
    script.async = true;
    script.onload = render;
    document.body.append(script);
  }, [elementId, groupId]);

  return <div id={elementId} style={{ minHeight: 30 }} />;
}
