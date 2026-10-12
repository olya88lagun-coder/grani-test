import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import type { CompassState } from "@/lib/money-practice";
import { CompassWheel, sectorPath } from "./CompassWheel";

const make = (states: CompassState[]) => states.map((state, i) => ({ id: `d${i}`, title: `Направление ${i}`, state, label: `Подпись ${state}` }));
const render = (states: CompassState[], active = 0) => renderToStaticMarkup(<CompassWheel directions={make(states)} activeIndex={active} onSelect={() => {}} />);

describe("sectorPath", () => {
  test("gives four different closed shapes, one per side of the wheel", () => {
    const paths = [0, 1, 2, 3].map(sectorPath);

    expect(new Set(paths).size).toBe(4);
    for (const path of paths) expect(path).toMatch(/^M[\d. -]+A[\d. -]+L[\d. -]+A[\d. -]+Z$/);
  });
});

describe("CompassWheel", () => {
  test("draws one sector per direction and marks its state", () => {
    const html = render(["pending", "observe", "mixed", "resource"]);

    expect(html.match(/<path[^>]*data-state="/g)).toHaveLength(4);
    for (const state of ["pending", "observe", "mixed", "resource"]) expect(html).toContain(`data-state="${state}"`);
  });

  test("a topic for a step gets a dot, other states do not", () => {
    expect(render(["practice", "practice", "pending", "pending"]).match(/<circle[^>]*data-marker/g)).toHaveLength(2);
    expect(render(["resource", "mixed", "pending", "observe"]).match(/<circle[^>]*data-marker/g)).toBeNull();
  });

  test("every direction is a button named by its title, pressed when active, and described by its state", () => {
    const html = render(["pending", "observe", "mixed", "resource"], 2);

    for (let i = 0; i < 4; i++) {
      expect(html).toContain(`data-direction="${i}"`);
      expect(html).toContain(`aria-describedby="money-dir-state-${i}"`);
      expect(html).toContain(`id="money-dir-state-${i}"`);
    }
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-pressed="true"[^>]*><span>Направление 2<\/span>/);
    expect(html).not.toContain('aria-label="Направление');
  });
});
