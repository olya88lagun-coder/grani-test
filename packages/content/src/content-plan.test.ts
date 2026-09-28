import { describe, expect, it } from "vitest";
import { CONTENT_PLAN, QUALITY_RULES, internalLinksForTopic, publishedCanonicalUrls, seoMetadataForTopic, topicsByStatus, validateContentPlan } from "./content-plan";

describe("CONTENT_PLAN", () => {
  it("starts with a 50-70 URL queue without publishing planned pages", () => {
    validateContentPlan();
    expect(CONTENT_PLAN.length).toBeGreaterThanOrEqual(50);
    expect(CONTENT_PLAN.length).toBeLessThanOrEqual(70);
    expect(topicsByStatus("published")).toHaveLength(0);
    expect(publishedCanonicalUrls()).toEqual([]);
  });

  it("keeps every planned URL canonical, unique and internal", () => {
    const paths = CONTENT_PLAN.map((topic) => topic.path);
    expect(new Set(paths).size).toBe(paths.length);
    for (const topic of CONTENT_PLAN) {
      expect(topic.canonical).toBe(topic.path);
      expect(topic.path).toMatch(/^\/articles\//);
      expect(topic.internalLinks.length).toBeGreaterThanOrEqual(3);
      expect(topic.internalLinks.every((link) => link.startsWith("/"))).toBe(true);
      expect(topic.internalLinks.some((link) => link.startsWith("http"))).toBe(false);
    }
  });

  it("generates SEO metadata and internal links from a topic", () => {
    const topic = CONTENT_PLAN.find((item) => item.slug === "ipip-50")!;
    expect(seoMetadataForTopic(topic)).toEqual({ title: topic.title, description: topic.description, alternates: { canonical: "/articles/ipip-50" } });
    expect(internalLinksForTopic("ipip-50")).toEqual(expect.arrayContaining(["/big-five-test", "/test", "/about"]));
  });

  it("records explicit quality rules for the semi-automatic pipeline", () => {
    expect(QUALITY_RULES.join("\n")).toContain("Не выдумывать исследования");
    expect(QUALITY_RULES.join("\n")).toContain("Не приравнивать типы Граней к MBTI");
    expect(QUALITY_RULES.join("\n")).toContain("reviewed: true");
  });
});
