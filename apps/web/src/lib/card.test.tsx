import { ImageResponse } from "next/og";
import { expect, test } from "vitest";
import { CARD_SIZE, cardElement, loadCardFonts } from "./card";
import { TYPE_VISUALS } from "./type-visuals";

test("renders a story-sized PNG", async () => {
  const visual = TYPE_VISUALS.pmpp;
  if (!visual) throw new Error("no visual for pmpp");
  const response = new ImageResponse(cardElement({ name: "Искра", visual }), { ...CARD_SIZE, fonts: await loadCardFonts() });
  const bytes = new Uint8Array(await response.arrayBuffer());
  expect([...bytes.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  // Ширина и высота PNG лежат в заголовке IHDR, байты 16–23
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  expect([view.getUint32(16), view.getUint32(20)]).toEqual([1080, 1920]);
  expect(bytes.byteLength).toBeLessThan(1_000_000);
}, 30_000);

test("fits a long gendered name", async () => {
  const visual = TYPE_VISUALS.mpmp;
  if (!visual) throw new Error("no visual for mpmp");
  const response = new ImageResponse(cardElement({ name: "Тихая хранительница", visual }), { ...CARD_SIZE, fonts: await loadCardFonts() });
  expect((await response.arrayBuffer()).byteLength).toBeGreaterThan(1000);
}, 30_000);
