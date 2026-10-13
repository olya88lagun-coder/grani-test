import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";
import { CompassPromo } from "./CompassPromo";

const HREF = "/report/r1/practice/money";

describe("CompassPromo", () => {
  test("the top block says what the compass gives before the button", () => {
    const html = renderToStaticMarkup(<CompassPromo href={HREF} />);

    expect(html.indexOf("6 вопросов")).toBeGreaterThan(-1);
    expect(html.indexOf("6 вопросов")).toBeLessThan(html.indexOf("<a"));
    expect(html).toContain("один небольшой шаг на неделю");
    expect(html).toContain(`href="${HREF}"`);
    expect(html).toContain("Открыть мой финансовый компас");
  });

  test("the closing block repeats the button for the chapter that ends in text", () => {
    const html = renderToStaticMarkup(<CompassPromo href={HREF} variant="foot" />);

    expect(html).toContain("Что дальше");
    expect(html).toContain(`href="${HREF}"`);
    expect(html).toContain("Открыть мой финансовый компас");
    expect(html).not.toContain("6 вопросов");
  });
});
