import type { ShareContent } from "./new-year-2027";

// Canvas text is never interpreted as HTML, and no service receives the generated image.
function wrap(ctx: CanvasRenderingContext2D, value: string, width: number): string[] {
  const result: string[] = [];
  let line = "";
  for (const character of value.replace(/\s+/g, " ")) {
    if (ctx.measureText(line + character).width > width && line) { result.push(line.trim()); line = character; }
    else line += character;
  }
  if (line.trim()) result.push(line.trim());
  return result;
}

export async function renderYearShare(content: ShareContent): Promise<Blob> {
  await document.fonts.ready;
  const crystal = new Image();
  crystal.src = "/home/hero-crystal.webp";
  const background = new Image();
  background.src = "/new-year-2027/winter-hero-v2.webp";
  await Promise.all([crystal.decode(), background.decode()]);
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");
  const body = getComputedStyle(document.body).fontFamily;
  ctx.font = `400 29px ${body}`;
  const sections = [["МОЯ ЦЕЛЬ", content.goal], ["ПЕРВЫЙ ШАГ", content.step]].filter((entry) => entry[1]).map(([label, value]) => ({ label: label!, lines: wrap(ctx, value!, 850) }));
  const contentBottom = 1145 + sections.reduce((height, section) => height + 100 + section.lines.length * 42, 0);
  canvas.height = content.goal ? Math.max(1920, contentBottom + 210) : 1350;
  ctx.fillStyle = "#0a1f17"; ctx.fillRect(0, 0, canvas.width, canvas.height);
  const scale = Math.max(canvas.width / background.width, canvas.height / background.height);
  ctx.drawImage(background, (canvas.width - background.width * scale) * .72, 0, background.width * scale, background.height * scale);
  ctx.fillStyle = "rgba(10,31,23,.8)"; ctx.fillRect(0, 0, canvas.width, canvas.height);
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
  text("grani-test.ru/new-year-2027", canvas.height - 115, 23, "#bac4b8");
  return new Promise((resolve, reject) => canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("png_failed")), "image/png"));
}

export function downloadYearShare(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url; link.download = "moi-grani-2027.png";
  document.body.appendChild(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
}
