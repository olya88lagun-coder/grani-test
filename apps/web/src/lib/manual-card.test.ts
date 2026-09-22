import { describe, expect, test } from "vitest";
import { buildManualCardModel, MANUAL_ITEM_LENGTH, shortenItem } from "./manual-card";
import { TYPE_VISUALS } from "./type-visuals";

describe("shortenItem", () => {
  test("keeps short items and cuts long ones at a word with an ellipsis", () => {
    expect(shortenItem("Давай мне время подумать.")).toBe("Давай мне время подумать.");
    const long = "Давай мне время подумать перед важным решением и не торопи, даже если кажется, что ответ очевиден";
    const cut = shortenItem(long);
    expect(cut.length).toBeLessThanOrEqual(MANUAL_ITEM_LENGTH);
    expect(cut.endsWith("…")).toBe(true);
    expect(long.startsWith(cut.slice(0, -1))).toBe(true);
    expect(cut.slice(0, -1).endsWith(" ")).toBe(false);
  });
});

test("takes three items of each manual list", () => {
  const full = {
    portrait: "п",
    strengths: [],
    blind_spots: [],
    manual: { work: ["р1", "р2", "р3", "р4"], fight: ["с1", "с2", "с3"], annoys: ["б1", "б2", "б3"] },
  };

  const model = buildManualCardModel(full, "Искра", TYPE_VISUALS["pmpp"]!);

  expect(model.lists).toEqual([
    { title: "Как со мной работать", items: ["р1", "р2", "р3"] },
    { title: "Как со мной ссориться", items: ["с1", "с2", "с3"] },
    { title: "Что меня бесит", items: ["б1", "б2", "б3"] },
  ]);
});
