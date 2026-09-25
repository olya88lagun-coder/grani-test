import { ImageResponse } from "next/og";
import { expect, test } from "vitest";
import { CARD_COLORS, CARD_SIZE, cardElement, loadCardFonts, manualCardElement } from "./card";
import { buildManualCardModel } from "./manual-card";
import { typeKeywords } from "./result-view";
import { contrastRatio, TYPE_VISUALS } from "./type-visuals";

async function pngBytes(response: ImageResponse): Promise<Uint8Array> {
  return new Uint8Array(await response.arrayBuffer());
}

function expectStoryPng(bytes: Uint8Array): void {
  expect([...bytes.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  // Ширина и высота PNG лежат в заголовке IHDR, байты 16–23
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  expect([view.getUint32(16), view.getUint32(20)]).toEqual([1080, 1920]);
  // Сторис грузят с телефона — без фотографий карточка остаётся лёгкой
  expect(bytes.byteLength).toBeLessThan(1_000_000);
}

test("renders a story-sized PNG", async () => {
  const visual = TYPE_VISUALS.pmpp;
  if (!visual) throw new Error("no visual for pmpp");
  const element = cardElement({ name: "Искра", visual, keywords: typeKeywords("+-++") });
  expectStoryPng(await pngBytes(new ImageResponse(element, { ...CARD_SIZE, fonts: await loadCardFonts() })));
}, 30_000);

test("fits a long gendered name", async () => {
  const visual = TYPE_VISUALS.mpmp;
  if (!visual) throw new Error("no visual for mpmp");
  const element = cardElement({ name: "Тихая хранительница", visual, keywords: typeKeywords("-+-+") });
  expectStoryPng(await pngBytes(new ImageResponse(element, { ...CARD_SIZE, fonts: await loadCardFonts() })));
}, 30_000);

test("renders the manual card with the longest items", async () => {
  const visual = TYPE_VISUALS.mpmp;
  if (!visual) throw new Error("no visual for mpmp");
  const long = "Давай мне время подумать перед важным решением и не торопи, даже если кажется, что ответ очевиден";
  const full = { portrait: "п", strengths: [], blind_spots: [], manual: { work: [long, long], fight: [long, long], annoys: [long, long] } };
  const element = manualCardElement(buildManualCardModel(full, "Тихая хранительница", visual));
  expectStoryPng(await pngBytes(new ImageResponse(element, { ...CARD_SIZE, fonts: await loadCardFonts() })));
}, 30_000);

test("card text is readable on the whole background", () => {
  for (const background of [CARD_COLORS.backgroundTop, CARD_COLORS.backgroundBottom]) {
    expect(contrastRatio(CARD_COLORS.ink, background)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(CARD_COLORS.green, background)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(CARD_COLORS.muted, background)).toBeGreaterThanOrEqual(4.5);
  }
});
