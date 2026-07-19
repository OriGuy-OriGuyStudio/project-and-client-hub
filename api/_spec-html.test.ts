// The PDF HTML builder has its OWN audience gating (it runs server-side and
// does not share code with src/lib/project-spec.ts), so it needs its own leak
// tests: a client PDF must never contain a studio-internal field.

import { describe, it, expect } from "vitest";
import { buildSpecHtml, type SpecDoc } from "./_spec-html";

const doc: SpecDoc = {
  audience: "client",
  projectTitle: "אתר לקליניקה",
  businessName: "קליניקת שגב",
  discoveryTitle: "שיחת אפיון",
  discovery: [
    { question: "מה המטרה?", answer: "יותר פניות" },
    { question: "בלי תשובה", answer: "  " },
  ],
  personas: [
    {
      name: "מיכל שגב",
      archetype: "בעלת עסק",
      age: "41",
      location: "רמת גן",
      summary: "מנהלת קליניקה",
      quote: "אין לי זמן",
      traits: ["ישירה"],
      goals: ["להיראות מקצועית"],
      pains: ["אתר ישן"],
      motivations: ["יותר פניות"],
      context: "מובייל",
      how_we_help: "אני בונה אתר מהיר",
      design_notes: "PERSONA_SECRET טון ישיר",
    },
  ],
  journey: {
    stages: [{ name: "מודעות", goal: "להבין", emotion: "סקרנות", touchpoints: ["גוגל"], pains: ["לא מכירה"], on_site: "בית", actions: ["מסר ברור"] }],
    design_notes: "JOURNEY_SECRET הירו תוך 3 שניות",
  },
  sitemap: {
    pages: [
      {
        name: "בית",
        purpose: "רושם ראשוני",
        sections: ["הירו"],
        order_rationale: "ORDER_SECRET הירו קודם",
        serves: "מיכל",
        children: [{ name: "תת עמוד", purpose: "פירוט", sections: [], serves: "", children: [] }],
      },
    ],
    design_notes: "SITEMAP_SECRET רשת 12",
  },
  generatedAt: new Date("2026-07-19T00:00:00Z"),
};

const SECRETS = ["PERSONA_SECRET", "JOURNEY_SECRET", "ORDER_SECRET", "SITEMAP_SECRET"];

describe("buildSpecHtml", () => {
  it("leaks no internal field into the client document", () => {
    const html = buildSpecHtml(doc);
    for (const s of SECRETS) expect(html).not.toContain(s);
  });

  it("includes every internal field in the full document", () => {
    const html = buildSpecHtml({ ...doc, audience: "full" });
    for (const s of SECRETS) expect(html).toContain(s);
  });

  it("marks the full document as internal, and the client one not", () => {
    expect(buildSpecHtml({ ...doc, audience: "full" })).toContain("מסמך פנימי");
    expect(buildSpecHtml(doc)).not.toContain("מסמך פנימי");
  });

  it("renders the real content", () => {
    const html = buildSpecHtml(doc);
    expect(html).toContain("אתר לקליניקה");
    expect(html).toContain("יותר פניות");
    expect(html).toContain("מיכל שגב");
    expect(html).toContain("מודעות");
    expect(html).toContain("תת עמוד");
  });

  it("drops unanswered discovery questions", () => {
    expect(buildSpecHtml(doc)).not.toContain("בלי תשובה");
  });

  it("escapes html so client-entered text cannot inject markup", () => {
    const html = buildSpecHtml({
      ...doc,
      discovery: [{ question: "q", answer: "<script>alert(1)</script>" }],
    });
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("survives missing sections without throwing", () => {
    const html = buildSpecHtml({
      ...doc,
      personas: [],
      journey: null,
      sitemap: null,
      discovery: [],
    });
    expect(html).toContain("אפיון הפרויקט");
    expect(html).not.toContain("<h2>פרסונות</h2>");
  });

  it("keeps each persona and stage in an unbreakable print block", () => {
    const html = buildSpecHtml(doc);
    expect(html).toContain('class="card keep"');
  });
});
