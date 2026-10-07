export const TOGETHER_ANSWER_MAX_LENGTH = 1200;

export type CardKind = "intro" | "main";
export type CardFieldType = "short_text" | "boolean";
export type CardField = {
  id: string;
  type: CardFieldType;
  label: string;
  required: boolean;
  maxLength?: number;
  availableAt?: "after_reveal";
};
// Карточка, как она выдана паре: копия из каталога на момент выдачи
export type CardSnapshot = {
  id: string;
  version: number;
  kind: CardKind;
  title: string;
  estimatedMinutes: number;
  prompt: string;
  hint: string;
  jointAction: string;
  skipAllowed: boolean;
  // Номер этапа (месяца минус один), с которого карточка открывается по оплаченному времени; 0 или не задан — открыта сразу
  unlockStage?: number;
  fields: CardField[];
};
export type AnswerFields = Record<string, string | boolean>;
export type AnswerCheck = { ok: true; fields: AnswerFields } | { ok: false; reason: "invalid_field" | "field_not_available"; field: string };

const invalid = (field: string): AnswerCheck => ({ ok: false, reason: "invalid_field", field });

const isPlainObject = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

// Проверка и очистка присланных полей по снимку карточки. Поля «после раскрытия» принимаются только когда ответы уже раскрыты
export function checkAnswerFields(card: CardSnapshot, input: unknown, revealed: boolean): AnswerCheck {
  if (!isPlainObject(input)) return invalid("");
  const known = new Set(card.fields.map((field) => field.id));
  for (const key of Object.keys(input)) if (!known.has(key)) return invalid(key);

  const fields: AnswerFields = {};
  for (const field of card.fields) {
    const value = input[field.id];
    if (value === undefined) {
      if (field.required) return invalid(field.id);
      continue;
    }
    if (field.availableAt === "after_reveal" && !revealed) return { ok: false, reason: "field_not_available", field: field.id };
    if (field.type === "boolean") {
      if (typeof value !== "boolean") return invalid(field.id);
      fields[field.id] = value;
      continue;
    }
    if (typeof value !== "string") return invalid(field.id);
    // NUL и одиночные суррогаты база (jsonb) не принимает, а её ошибка цитирует начало текста: отсекаем до записи
    if (value.includes("\u0000") || /\p{Cs}/u.test(value)) return invalid(field.id);
    const text = value.trim();
    if (text === "") {
      if (field.required) return invalid(field.id);
      continue;
    }
    if ([...text].length > (field.maxLength ?? TOGETHER_ANSWER_MAX_LENGTH)) return invalid(field.id);
    fields[field.id] = text;
  }
  return { ok: true, fields };
}
