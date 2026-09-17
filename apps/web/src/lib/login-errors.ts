const MESSAGES: Readonly<Record<string, string>> = {
  consent_required: "Чтобы сохранить результат, отметьте согласие на обработку данных и войдите ещё раз.",
  vk_state_mismatch: "Вход через VK ID занял слишком много времени. Попробуйте ещё раз.",
  vk_missing_params: "VK ID не вернул данные для входа. Попробуйте ещё раз.",
};

const TELEGRAM_FALLBACK = "Telegram не подтвердил вход. Попробуйте ещё раз.";
const GENERIC_FALLBACK = "Не получилось войти. Попробуйте ещё раз или выберите другой способ.";

export function loginErrorMessage(code: string | null): string | null {
  if (code === null) return null;
  const known = MESSAGES[code];
  if (known) return known;
  return code.startsWith("telegram_") ? TELEGRAM_FALLBACK : GENERIC_FALLBACK;
}
