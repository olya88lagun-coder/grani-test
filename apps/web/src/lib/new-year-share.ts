import type { ShareContent } from "./new-year-2027";
import type { YearSlide } from "./new-year-cards";
import { trackYearEvent } from "./new-year-analytics";
import { SHARE_URL_TEXT } from "./new-year-copy";

const SHARE_PAGE_NAME = "moi-grani-2027";

// Canvas text is never interpreted as HTML, and no service receives the generated image.
// Breaks on spaces; only a single word wider than the line (a long unbroken string) is split by character.
function wrap(ctx: CanvasRenderingContext2D, value: string, width: number): string[] {
  const result: string[] = [];
  let line = "";
  const flush = () => { if (line.trim()) result.push(line.trim()); line = ""; };
  for (const word of value.replace(/\s+/g, " ").trim().split(" ")) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= width) { line = candidate; continue; }
    flush();
    if (ctx.measureText(word).width <= width) { line = word; continue; }
    for (const character of word) {
      if (ctx.measureText(line + character).width > width && line) flush();
      line += character;
    }
  }
  flush();
  return result;
}

async function loadArt(): Promise<{ crystal: HTMLImageElement; background: HTMLImageElement }> {
  await document.fonts.ready;
  const crystal = new Image();
  crystal.src = "/home/hero-crystal.webp";
  const background = new Image();
  background.src = "/new-year-2027/winter-hero-v2.webp";
  await Promise.all([crystal.decode(), background.decode()]);
  return { crystal, background };
}

function paintBackdrop(ctx: CanvasRenderingContext2D, background: HTMLImageElement, width: number, height: number, veil: number): void {
  ctx.fillStyle = "#0a1f17"; ctx.fillRect(0, 0, width, height);
  const scale = Math.max(width / background.width, height / background.height);
  ctx.drawImage(background, (width - background.width * scale) * .72, 0, background.width * scale, background.height * scale);
  ctx.fillStyle = `rgba(10,31,23,${veil})`; ctx.fillRect(0, 0, width, height);
}

function canvasToPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("png_failed")), "image/png"));
}

function makeCanvas(width: number, height: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; body: string; display: string } {
  const canvas = document.createElement("canvas");
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  const body = getComputedStyle(document.body).fontFamily;
  const display = getComputedStyle(document.body).getPropertyValue("--font-display").trim() || "Georgia, serif";
  return { canvas, ctx, body, display };
}

export async function renderYearShare(content: ShareContent): Promise<Blob> {
  const { crystal, background } = await loadArt();
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  const body = getComputedStyle(document.body).fontFamily;
  ctx.font = `400 29px ${body}`;
  const sections = [["МОЯ ЦЕЛЬ", content.goal], ["ПЕРВЫЙ ШАГ", content.step]].filter((entry) => entry[1]).map(([label, value]) => ({ label: label!, lines: wrap(ctx, value!, 850) }));
  const contentBottom = 1145 + sections.reduce((height, section) => height + 100 + section.lines.length * 42, 0);
  canvas.height = content.goal ? Math.max(1920, contentBottom + 210) : 1350;
  paintBackdrop(ctx, background, canvas.width, canvas.height, .8);
  ctx.strokeStyle = "#716541"; ctx.lineWidth = 1; ctx.strokeRect(45, 45, 990, canvas.height - 90);
  ctx.textAlign = "center";
  const display = getComputedStyle(document.body).getPropertyValue("--font-display").trim() || "Georgia, serif";
  const text = (value: string, y: number, size: number, color: string, serif = false) => {
    ctx.fillStyle = color; ctx.font = `400 ${size}px ${serif ? display : body}`;
    ctx.fillText(value, 540, y);
  };
  text("грани", 145, 62, "#efe9da", true);
  text("МОИ ГРАНИ", 238, 23, "#cdb57b");
  text("2027", 415, 186, "#cdb57b", true);
  ctx.drawImage(crystal, 370, 465, 340, 408);
  text(content.title, 960, 72, "#efe9da", true);
  text(content.subtitle, 1035, 28, "#bac4b8");
  let y = 1145;
  for (const section of sections) {
    text(section.label, y, 21, "#cdb57b"); y += 55;
    for (const line of section.lines) { text(line, y, 29, "#efe9da"); y += 42; }
    y += 45;
  }
  text(SHARE_URL_TEXT, canvas.height - 115, 23, "#bac4b8");
  return canvasToPng(canvas);
}

// Shrinks a single display word until it fits the frame, so a long custom word never runs off the card.
function fitWord(ctx: CanvasRenderingContext2D, display: string, word: string, start: number, width: number): number {
  let size = start;
  ctx.font = `400 ${size}px ${display}`;
  while (size > 56 && ctx.measureText(word).width > width) { size -= 6; ctx.font = `400 ${size}px ${display}`; }
  return size;
}

const SLIDE_WIDTH = 1080;
const SLIDE_TEXT_WIDTH = 820;
const SLIDE_LINE = 62;

// One story-sized card per map section. The caller decides whether a personal slide may be rendered at all.
export async function renderSlideCard(slide: YearSlide): Promise<Blob> {
  const { crystal, background } = await loadArt();
  const measure = makeCanvas(SLIDE_WIDTH, 1350);
  const { ctx: probe, display } = measure;
  probe.font = `400 44px ${display}`;
  const lines = slide.id === "word" ? [] : wrap(probe, slide.text, SLIDE_TEXT_WIDTH);
  const height = slide.id === "word" ? 1350 : Math.max(1350, 560 + lines.length * SLIDE_LINE + 330);
  const { canvas, ctx, body } = makeCanvas(SLIDE_WIDTH, height);
  paintBackdrop(ctx, background, canvas.width, canvas.height, .78);
  ctx.strokeStyle = "#716541"; ctx.lineWidth = 1; ctx.strokeRect(45, 45, 990, height - 90);
  ctx.textAlign = "center";
  const put = (value: string, y: number, size: number, color: string, serif = false) => { ctx.fillStyle = color; ctx.font = `400 ${size}px ${serif ? display : body}`; ctx.fillText(value, 540, y); };
  put("грани", 145, 62, "#efe9da", true);
  put(slide.kicker.toUpperCase(), 270, 23, "#cdb57b");
  if (slide.id === "word") {
    const size = fitWord(ctx, display, slide.text, 190, 820);
    put(slide.text, 600, size, "#efe9da", true);
    ctx.drawImage(crystal, 370, 700, 340, 408);
  } else {
    let y = 480;
    for (const line of lines) { put(line, y, 44, "#efe9da", true); y += SLIDE_LINE; }
    ctx.drawImage(crystal, 440, height - 440, 200, 240);
  }
  put(SHARE_URL_TEXT, height - 100, 23, "#bac4b8");
  return canvasToPng(canvas);
}

// Phone wallpaper: the stock-or-chosen word only, never answers. Clock and dock zones are kept clear.
export async function renderWallpaper(word: string): Promise<Blob> {
  const { crystal, background } = await loadArt();
  const { canvas, ctx, body, display } = makeCanvas(1080, 2340);
  paintBackdrop(ctx, background, canvas.width, canvas.height, .66);
  ctx.textAlign = "center";
  const put = (value: string, y: number, size: number, color: string, serif = false) => { ctx.fillStyle = color; ctx.font = `400 ${size}px ${serif ? display : body}`; ctx.fillText(value, 540, y); };
  put("МОИ ГРАНИ · 2027", 860, 26, "#cdb57b");
  const size = fitWord(ctx, display, word, 180, 860);
  put(word, 1040, size, "#efe9da", true);
  ctx.drawImage(crystal, 370, 1130, 340, 408);
  put("Не весь год сразу.", 1700, 40, "#efe9da", true);
  put("Один свой шаг.", 1760, 40, "#cdb57b", true);
  put(SHARE_URL_TEXT, 2110, 22, "#bac4b8");
  return canvasToPng(canvas);
}

export function downloadYearShare(blob: Blob, filename = `${SHARE_PAGE_NAME}.png`): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = filename;
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

export type DeliveryOutcome = "shared" | "fallback" | "downloaded";
// Native share when the device supports files, otherwise a download. A cancelled share rethrows its AbortError for the caller to word.
export async function deliverYearImage(blob: Blob, filename: string, share: boolean): Promise<DeliveryOutcome> {
  const file = new File([blob], filename, { type: "image/png" });
  if (share && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      trackYearEvent("new_year_share");
      return "shared";
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") throw error;
      downloadYearShare(blob, filename); trackYearEvent("new_year_download");
      return "fallback";
    }
  }
  downloadYearShare(blob, filename); trackYearEvent("new_year_download");
  return "downloaded";
}
