import { describe, it, expect } from "vitest";
import {
  specToMarkdown,
  specIsEmpty,
  personaLines,
  journeyLines,
  sitemapLines,
  type SpecInput,
} from "./project-spec";
import type { PersonaContent, JourneyContent, SitemapContent } from "@/types/database";

const persona: PersonaContent = {
  name: "מיכל שגב",
  archetype: "בעלת עסק עסוקה",
  gender: "female",
  summary: "מנהלת קליניקה, מחפשת נוכחות מקצועית.",
  age: "41",
  location: "רמת גן",
  traits: ["ישירה", "חסרת סבלנות לטפסים"],
  quote: "אין לי זמן לרדוף אחרי אף אחד",
  goals: ["להיראות מקצועית"],
  pains: ["אתר ישן"],
  motivations: ["יותר פניות"],
  context: "מובייל, בערב",
  how_we_help: "אני בונה לה אתר מהיר",
  design_notes: "טון ישיר, מחיר גלוי מוקדם, CTA טלפוני",
  avatar_url: null,
};

const journey: JourneyContent = {
  title: "מסע",
  stages: [
    {
      name: "מודעות",
      goal: "להבין מי אנחנו",
      emotion: "סקרנות",
      touchpoints: ["גוגל"],
      pains: ["לא מכירה"],
      on_site: "עמוד בית",
      actions: ["מסר ברור"],
    },
  ],
  design_notes: "הירו חייב לענות תוך 3 שניות",
};

const sitemap: SitemapContent = {
  title: "מפה",
  pages: [
    {
      name: "בית",
      purpose: "רושם ראשוני",
      sections: ["הירו", "שירותים"],
      order_rationale: "הירו קודם כי הוא ממיר",
      serves: "מיכל",
      children: [{ name: "תת עמוד", purpose: "פירוט", sections: [], serves: "", children: [] }],
    },
  ],
  design_notes: "רשת של 12 עמודות",
};

const base: SpecInput = {
  projectTitle: "אתר לקליניקה",
  businessName: "קליניקת שגב",
  discoveryTitle: "שיחת אפיון",
  discovery: [
    { question: "מה המטרה?", answer: "יותר פניות" },
    { question: "שאלה בלי תשובה", answer: "   " },
  ],
  personas: [persona],
  journey,
  sitemap,
  generatedAt: new Date("2026-07-19T10:00:00Z"),
};

describe("project spec export", () => {
  describe("internal content stripping (the client must never see design_notes)", () => {
    it("omits persona design_notes for the client audience", () => {
      const out = personaLines(persona, "client").join("\n");
      expect(out).not.toContain("טון ישיר");
      expect(out).not.toContain("פנימי");
    });

    it("includes persona design_notes for the full audience", () => {
      const out = personaLines(persona, "full").join("\n");
      expect(out).toContain("טון ישיר");
    });

    it("omits journey design_notes for the client audience", () => {
      expect(journeyLines(journey, "client").join("\n")).not.toContain("3 שניות");
      expect(journeyLines(journey, "full").join("\n")).toContain("3 שניות");
    });

    it("omits sitemap design_notes and order rationale for the client audience", () => {
      const client = sitemapLines(sitemap, "client").join("\n");
      expect(client).not.toContain("12 עמודות");
      expect(client).not.toContain("ממיר");
      const full = sitemapLines(sitemap, "full").join("\n");
      expect(full).toContain("12 עמודות");
      expect(full).toContain("ממיר");
    });

    it("leaks no internal note anywhere in a full client document", () => {
      const md = specToMarkdown(base, "client");
      for (const secret of ["טון ישיר", "3 שניות", "12 עמודות", "הירו קודם כי"]) {
        expect(md).not.toContain(secret);
      }
    });
  });

  describe("document content", () => {
    it("includes the discovery call, personas, journey and sitemap", () => {
      const md = specToMarkdown(base, "client");
      expect(md).toContain("סיכום שיחת האפיון");
      expect(md).toContain("יותר פניות");
      expect(md).toContain("מיכל שגב");
      expect(md).toContain("מודעות");
      expect(md).toContain("בית");
    });

    it("drops discovery questions that were never answered", () => {
      expect(specToMarkdown(base, "client")).not.toContain("שאלה בלי תשובה");
    });

    it("nests sub-pages under their parent page", () => {
      expect(sitemapLines(sitemap, "client").join("\n")).toContain("  - תת עמוד");
    });

    it("marks the full version as internal in the header", () => {
      expect(specToMarkdown(base, "full")).toContain("מסמך פנימי");
      expect(specToMarkdown(base, "client")).not.toContain("מסמך פנימי");
    });

    it("survives a project with only a discovery call", () => {
      const md = specToMarkdown(
        { ...base, personas: [], journey: null, sitemap: null },
        "client",
      );
      expect(md).toContain("יותר פניות");
      expect(md).not.toContain("## פרסונות");
    });

    it("never emits three consecutive newlines", () => {
      expect(specToMarkdown(base, "full")).not.toMatch(/\n{3}/);
    });
  });

  describe("specIsEmpty", () => {
    it("is true when there is nothing to export", () => {
      expect(
        specIsEmpty({ ...base, discovery: [], personas: [], journey: null, sitemap: null }),
      ).toBe(true);
    });

    it("is true when the only discovery answers are blank", () => {
      expect(
        specIsEmpty({
          ...base,
          discovery: [{ question: "ש", answer: "  " }],
          personas: [],
          journey: null,
          sitemap: null,
        }),
      ).toBe(true);
    });

    it("is false when anything at all exists", () => {
      expect(specIsEmpty({ ...base, personas: [], journey: null, sitemap: null })).toBe(false);
      expect(specIsEmpty({ ...base, discovery: [], journey: null, sitemap: null })).toBe(false);
    });
  });
});
