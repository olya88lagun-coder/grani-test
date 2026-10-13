import type { GenerateLog, ReportWriter } from "./generate";
import { CARD_ATTEMPTS, runPrompt } from "./generate-chapter";
import { assemblePortrait, buildPortraitPrompt, portraitSources, validatePortrait, type PortraitContext } from "./portrait-cards";
import type { PortraitSections } from "./sections";

type Options = { timeoutMs?: number; attempts?: number; log?: GenerateLog };

// Фраза и пять блоков «Портрета» одним запросом. Если за все попытки не получилось, возвращается null:
// запасного текста у вкладки нет, на странице остаётся нынешний вид
export async function generatePortrait(writer: ReportWriter, ctx: PortraitContext, rawOptions: Options = {}): Promise<{ sections: PortraitSections; attempts: number } | null> {
  const options: Options = { attempts: CARD_ATTEMPTS, ...rawOptions };
  const sources = portraitSources(ctx);
  const result = await runPrompt(writer, { kind: "portrait", part: "portrait" }, buildPortraitPrompt(ctx), (raw, final) => validatePortrait(raw, sources, final), options);
  if (!result) return null;
  const sections = assemblePortrait(result.value);
  if (!sections) {
    options.log?.("chapter cards rejected", { kind: "portrait", writer: writer.name, reason: "assembly" });
    return null;
  }
  return { sections, attempts: result.attempts };
}
