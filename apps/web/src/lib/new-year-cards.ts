import { isStockWord, type YearAnswers, type YearMap } from "./new-year-2027";
import { DEFAULT_FIRST_STEP, DEFAULT_IF_THEN } from "./new-year-copy";

export type SlideId = "word" | "support" | "leave" | "step" | "ifthen";
// `personal` means the text was derived from the person's own answers or edits. Such slides are never exported without explicit consent.
export type YearSlide = { id: SlideId; kicker: string; text: string; personal: boolean };

// Stock options only, so the demo card on the landing page is the same for everyone and is not anybody's result.
export const SAMPLE_ANSWERS: YearAnswers = {
  recap: "Год перемен", gratitude: "За заботу о себе", release: "Спешку",
  direction: "Больше спокойствия", goal: "Вернуться к любимому делу", obstacle: "Усталость",
};

// A wallpaper sits on a lock screen anyone can see, so only stock words may appear on it, never typed text.
export const wallpaperWord = (word: string, fallback: string): string => isStockWord(word) ? word : fallback;

export function buildSlides(map: YearMap, word: string, firstStep: string, ifThen: string): YearSlide[] {
  const slides: YearSlide[] = [
    { id: "word", kicker: "Слово 2027", text: word, personal: !isStockWord(word) },
    { id: "support", kicker: "Моя опора", text: map.strength ?? map.supports[0]!, personal: map.strength !== null || map.profileUsed },
  ];
  if (map.leave) slides.push({ id: "leave", kicker: "Оставляю в 2026", text: map.leave.text, personal: true });
  slides.push(
    { id: "step", kicker: "Мой первый шаг", text: firstStep, personal: firstStep.trim() !== DEFAULT_FIRST_STEP },
    { id: "ifthen", kicker: "Если что-то помешает", text: ifThen, personal: ifThen.trim() !== DEFAULT_IF_THEN },
  );
  return slides;
}
