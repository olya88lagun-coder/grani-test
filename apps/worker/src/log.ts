export type Logger = (level: "info" | "warn" | "error", message: string, extra?: Record<string, unknown>) => void;

// JSON-строки для docker logs; в extra — только id и технические причины; текст сообщения пишет только локальный dry run
export const log: Logger = (level, message, extra = {}) => {
  const line = JSON.stringify({ at: new Date().toISOString(), level, message, ...extra });
  if (level === "error") console.error(line);
  else console.log(line);
};
