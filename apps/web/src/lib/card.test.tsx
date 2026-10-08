import { ImageResponse } from "next/og";
import { expect, test } from "vitest";
import { CARD_SIZE, cardElement, loadCardArt, loadCardFonts, manualCardElement, MANUAL_CARD_PANEL, NIGHT_CARD } from "./card";
import { buildManualCardModel } from "./manual-card";
import { typeKeywords } from "./result-view";
import { contrastRatio, TYPE_VISUALS } from "./type-visuals";

async function pngBytes(response: ImageResponse): Promise<Uint8Array> {
  return new Uint8Array(await response.arrayBuffer());
}

// Обе карточки используют ночные фотофоны и PNG камня типа.
const TYPE_CARD_MAX_BYTES = 2_000_000;
const MANUAL_CARD_MAX_BYTES = 1_000_000;

function expectStoryPng(bytes: Uint8Array, maxBytes: number): void {
  expect([...bytes.slice(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  // Ширина и высота PNG лежат в заголовке IHDR, байты 16–23
  const view = new DataView(bytes.buffer, bytes.byteOffset);
  expect([view.getUint32(16), view.getUint32(20)]).toEqual([1080, 1920]);
  // Сторис грузят с телефона — вес ограничен
  expect(bytes.byteLength).toBeLessThan(maxBytes);
}

test("renders a story-sized PNG", async () => {
  const element = cardElement({ name: "Искра", keywords: typeKeywords("+-++"), ...(await loadCardArt("pmpp", 2)) });
  expectStoryPng(await pngBytes(new ImageResponse(element, { ...CARD_SIZE, fonts: await loadCardFonts() })), TYPE_CARD_MAX_BYTES);
}, 30_000);

test("fits a long gendered name", async () => {
  const element = cardElement({ name: "Тихая хранительница", keywords: typeKeywords("-+-+"), ...(await loadCardArt("mpmp", 3)) });
  expectStoryPng(await pngBytes(new ImageResponse(element, { ...CARD_SIZE, fonts: await loadCardFonts() })), TYPE_CARD_MAX_BYTES);
}, 30_000);

test("renders the manual card with the longest items", async () => {
  const visual = TYPE_VISUALS.mpmp;
  if (!visual) throw new Error("no visual for mpmp");
  const long = "Давай мне время подумать перед важным решением и не торопи, даже если кажется, что ответ очевиден";
  const full = { portrait: "п", strengths: [], blind_spots: [], manual: { work: [long, long], fight: [long, long], annoys: [long, long] } };
  const element = manualCardElement({ ...buildManualCardModel(full, "Тихая хранительница", visual), ...(await loadCardArt("mpmp", visual.family)) });
  expectStoryPng(await pngBytes(new ImageResponse(element, { ...CARD_SIZE, fonts: await loadCardFonts() })), MANUAL_CARD_MAX_BYTES);
}, 30_000);

test("manual card text and numbers are readable on the panels", () => {
  for (const background of [NIGHT_CARD.base, MANUAL_CARD_PANEL]) {
    expect(contrastRatio(NIGHT_CARD.ink, background)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(NIGHT_CARD.muted, background)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(NIGHT_CARD.gold, background)).toBeGreaterThanOrEqual(4.5);
  }
});

test("night card text is readable on the dark base", () => {
  expect(contrastRatio(NIGHT_CARD.ink, NIGHT_CARD.base)).toBeGreaterThanOrEqual(7);
  expect(contrastRatio(NIGHT_CARD.muted, NIGHT_CARD.base)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(NIGHT_CARD.gold, NIGHT_CARD.base)).toBeGreaterThanOrEqual(4.5);
});

test("every type has its own gem and a background for its family", async () => {
  for (const [dir, visual] of Object.entries(TYPE_VISUALS)) {
    const art = await loadCardArt(dir, visual.family);
    expect(art.gem.startsWith("data:image/png;base64,")).toBe(true);
    expect(art.background.startsWith("data:image/jpeg;base64,")).toBe(true);
  }
  await expect(loadCardArt("xxxx", 1)).rejects.toThrow("No gem image for type xxxx");
});
