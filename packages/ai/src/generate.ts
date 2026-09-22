import type { ReportKind } from "@grani/core";
import { fallbackSections } from "./fallback";
import type { ReportInput } from "./input";
import { buildPrompt, type Prompt } from "./prompt";
import type { ReportSections } from "./sections";
import { validateModelOutput } from "./validate";

export type ReportWriter = { readonly name: string; complete(prompt: Prompt, signal: AbortSignal): Promise<string> };
export type GenerateLog = (message: string, extra: Record<string, unknown>) => void;
export type GeneratedReport = { sections: ReportSections[ReportKind]; source: "ai" | "fallback"; attempts: number };

export const GENERATION_TIMEOUT_MS = 60_000;
export const GENERATION_ATTEMPTS = 3;

class TimeoutError extends Error {}

// Сигнал отменяет запрос у провайдера; гонка с таймером страхует, если провайдер сигнал не слушает
async function completeWithTimeout(writer: ReportWriter, prompt: Prompt, timeoutMs: number): Promise<string> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new TimeoutError());
    }, timeoutMs);
  });
  try {
    return await Promise.race([writer.complete(prompt, controller.signal), timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function generateReport(
  writer: ReportWriter | null,
  input: ReportInput,
  options: { timeoutMs?: number; attempts?: number; log?: GenerateLog } = {},
): Promise<GeneratedReport> {
  if (!writer) return { sections: fallbackSections(input), source: "fallback", attempts: 0 };
  const attempts = options.attempts ?? GENERATION_ATTEMPTS;
  const prompt = buildPrompt(input);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let reason: string;
    try {
      const raw = await completeWithTimeout(writer, prompt, options.timeoutMs ?? GENERATION_TIMEOUT_MS);
      const checked = validateModelOutput(input.kind, raw);
      if (checked.ok) return { sections: checked.sections, source: "ai", attempts: attempt };
      reason = checked.reason;
    } catch (error) {
      reason = error instanceof TimeoutError ? "timeout" : `error: ${String(error)}`;
    }
    // Текст ответа в лог не пишется: в нём может оказаться то, что проверка как раз не пропустила
    options.log?.("report attempt rejected", { kind: input.kind, writer: writer.name, attempt, reason });
  }
  return { sections: fallbackSections(input), source: "fallback", attempts };
}
