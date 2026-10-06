const MESSAGES: Readonly<Record<string, string>> = {
  consent_required: "Чтобы сохранить результат, отметьте согласие на обработку данных и войдите ещё раз.",
  vk_state_mismatch: "Вход через VK ID занял слишком много времени. Попробуйте ещё раз.",
  vk_missing_params: "VK ID не вернул данные для входа. Попробуйте ещё раз.",
  handoff_expired: "Ссылка для переноса результата устарела. Вернитесь в приложение и скопируйте её заново — или пройдите тест здесь.",
};

const GENERIC_FALLBACK = "Не получилось войти. Попробуйте ещё раз или выберите другой способ.";

export function loginErrorMessage(code: string | null): string | null {
  if (code === null) return null;
  return MESSAGES[code] ?? GENERIC_FALLBACK;
}
