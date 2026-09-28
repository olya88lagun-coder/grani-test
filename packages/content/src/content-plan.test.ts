import { describe, expect, it } from "vitest";
import { getAllArticles } from "./data";
import { CONTENT_PLAN, QUALITY_RULES, internalLinksForTopic, publishedCanonicalUrls, seoMetadataForTopic, topicsByStatus, validateContentPlan } from "./content-plan";

describe("CONTENT_PLAN", () => {
  it("holds a 50-70 URL queue", () => {
    validateContentPlan();
    expect(CONTENT_PLAN.length).toBeGreaterThanOrEqual(50);
    expect(CONTENT_PLAN.length).toBeLessThanOrEqual(70);
  });

  // Конвейер отмечает тему опубликованной вместе со статьёй: план и статьи не должны расходиться
  it("marks a topic published exactly when its article is published", () => {
    const articles = new Map(getAllArticles().map((article) => [article.slug, article]));
    for (const topic of CONTENT_PLAN) {
      const article = articles.get(topic.slug);
      expect(topic.status === "published", topic.slug).toBe(article?.status === "published");
    }
    expect(publishedCanonicalUrls()).toEqual(topicsByStatus("published").map((topic) => topic.canonical));
  });

  it("does not queue a topic that repeats an existing article", () => {
    const existing = new Set(getAllArticles().map((article) => article.slug));
    for (const slug of ["ambivert-kto-eto", "chto-takoe-big-five", "mbti-i-big-five", "socionika-i-big-five", "temperament-i-lichnost"]) {
      expect(CONTENT_PLAN.some((topic) => topic.slug === slug), slug).toBe(false);
    }
    expect(existing.size).toBeGreaterThan(0);
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

  it("records explicit quality rules for the automatic pipeline", () => {
    expect(QUALITY_RULES.join("\n")).toContain("Не выдумывать исследования");
    expect(QUALITY_RULES.join("\n")).toContain("Не приравнивать типы Граней к MBTI");
    expect(QUALITY_RULES.join("\n")).toContain("reviewed: true");
  });
});
