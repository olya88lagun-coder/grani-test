import raw from "./generated/library.json";
import { parseLibrary, type Library } from "./library";

let cached: Library | undefined;

export function getLibrary(): Library {
  cached ??= parseLibrary(raw);
  return cached;
}
