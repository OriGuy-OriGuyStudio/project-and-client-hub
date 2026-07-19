// Project spec export , turns the "אפיון האתר" deliverables (personas,
// customer journey, sitemap) plus the discovery call into one document, in two
// audiences:
//   - "client": what the client may read. Every `design_notes` field is
//     stripped, because those are the studio's internal design/copy guidance
//     ("פנימי, לא מוצג ללקוח" in the tools that produce them).
//   - "full":  everything, for Ori and for feeding an AI tool the whole
//     context of the project.
// Pure functions only (no React, no Supabase) so the wording and, above all,
// the internal-content stripping are unit-testable.

import type {
  PersonaContent,
  JourneyContent,
  SitemapContent,
  SitemapPage,
} from "@/types/database";

export type SpecAudience = "client" | "full";

export type SpecInput = {
  projectTitle: string;
  businessName?: string | null;
  /** Discovery call: the questions and the client's answers. */
  discoveryTitle?: string | null;
  discovery?: { question: string; answer: string }[];
  personas?: PersonaContent[];
  journey?: JourneyContent | null;
  sitemap?: SitemapContent | null;
  /** Rendered into the header so the reader knows how current the document is. */
  generatedAt: Date;
};

const NL = "\n";

function line(label: string, value?: string | null): string | null {
  const v = (value ?? "").trim();
  return v ? `${label}: ${v}` : null;
}

function bullets(items?: string[]): string[] {
  return (items ?? []).map((i) => (i ?? "").trim()).filter(Boolean).map((i) => `- ${i}`);
}

function block(title: string, items?: string[]): string[] {
  const b = bullets(items);
  return b.length ? [`${title}:`, ...b] : [];
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" });
}

/** One persona as plain lines. `design_notes` is emitted ONLY for the full
 *  (internal) audience , this is the single place that decision is made. */
export function personaLines(p: PersonaContent, audience: SpecAudience): string[] {
  const head = [
    line("ארכיטיפ", p.archetype),
    line("גיל", p.age),
    line("מיקום", p.location),
  ].filter(Boolean) as string[];

  const out: string[] = [
    ...head,
    ...(p.summary?.trim() ? ["", p.summary.trim()] : []),
    ...(p.quote?.trim() ? ["", `ציטוט: "${p.quote.trim()}"`] : []),
    "",
    ...block("תכונות", p.traits),
    ...block("מטרות", p.goals),
    ...block("כאבים", p.pains),
    ...block("מניעים", p.motivations),
  ];

  const ctx = line("הקשר שימוש", p.context);
  if (ctx) out.push(ctx);
  const help = line("איך אני עוזר", p.how_we_help);
  if (help) out.push(help);

  if (audience === "full") {
    const notes = line("המלצות עיצוב וקופי (פנימי)", p.design_notes);
    if (notes) out.push(notes);
  }
  return out.filter((l, i, arr) => !(l === "" && arr[i - 1] === ""));
}

/** One journey stage on its own , the print view renders each stage as an
 *  unbreakable block so a stage never splits across two PDF pages. */
export function journeyStageLines(s: JourneyContent["stages"][number], index: number): string[] {
  const out: string[] = [`${index + 1}. ${s.name}`];
  out.push(
    ...([line("מטרה", s.goal), line("תחושה", s.emotion), line("באתר", s.on_site)].filter(
      Boolean,
    ) as string[]),
  );
  out.push(...block("נקודות מגע", s.touchpoints));
  out.push(...block("כאבים", s.pains));
  out.push(...block("מה אני עושה", s.actions));
  return out;
}

export function journeyLines(j: JourneyContent, audience: SpecAudience): string[] {
  const out: string[] = [];
  (j.stages ?? []).forEach((s, i) => {
    out.push(...journeyStageLines(s, i));
    out.push("");
  });
  if (audience === "full") {
    const notes = line("המלצות עיצוב (פנימי)", j.design_notes);
    if (notes) out.push(notes);
  }
  return out;
}

/** One top-level sitemap page (with its sub-pages), for the same unbreakable
 *  print blocks as the journey stages. */
export function sitemapTopPageLines(page: SitemapPage, audience: SpecAudience): string[] {
  return sitemapPageLines(page, 0, audience);
}

function sitemapPageLines(page: SitemapPage, depth: number, audience: SpecAudience): string[] {
  const pad = "  ".repeat(depth);
  const out: string[] = [`${pad}${depth === 0 ? "" : "- "}${page.name}`];
  const purpose = (page.purpose ?? "").trim();
  if (purpose) out.push(`${pad}  מטרה: ${purpose}`);
  const serves = (page.serves ?? "").trim();
  if (serves) out.push(`${pad}  משרת: ${serves}`);
  const sections = (page.sections ?? []).map((s) => (s ?? "").trim()).filter(Boolean);
  if (sections.length) out.push(`${pad}  סקשנים: ${sections.join(" · ")}`);
  const rationale = (page.order_rationale ?? "").trim();
  if (rationale && audience === "full") out.push(`${pad}  למה בסדר הזה (פנימי): ${rationale}`);
  for (const child of page.children ?? []) out.push(...sitemapPageLines(child, depth + 1, audience));
  return out;
}

export function sitemapLines(s: SitemapContent, audience: SpecAudience): string[] {
  const out: string[] = [];
  for (const p of s.pages ?? []) {
    out.push(...sitemapPageLines(p, 0, audience));
    out.push("");
  }
  if (audience === "full") {
    const notes = line("המלצות עיצוב (פנימי)", s.design_notes);
    if (notes) out.push(notes);
  }
  return out;
}

/** The whole document as Markdown , what the "העתק ל-AI" button copies. Plain
 *  text survives the trip into an AI tool intact, unlike a Hebrew RTL PDF. */
export function specToMarkdown(input: SpecInput, audience: SpecAudience): string {
  const parts: string[] = [];
  const who = [input.projectTitle, input.businessName].map((s) => (s ?? "").trim()).filter(Boolean);
  parts.push(`# אפיון פרויקט: ${who.join(" , ") || "ללא שם"}`);
  parts.push(
    audience === "full"
      ? `נוצר ב-${formatDate(input.generatedAt)} · מסמך פנימי, כולל הערות עבודה`
      : `נוצר ב-${formatDate(input.generatedAt)}`,
  );

  const disc = (input.discovery ?? []).filter((d) => (d.answer ?? "").trim());
  if (disc.length) {
    parts.push("", "## סיכום שיחת האפיון");
    if ((input.discoveryTitle ?? "").trim()) parts.push(`(${input.discoveryTitle!.trim()})`);
    for (const d of disc) {
      parts.push("", `**${d.question.trim()}**`, d.answer.trim());
    }
  }

  const personas = input.personas ?? [];
  if (personas.length) {
    parts.push("", "## פרסונות");
    for (const p of personas) {
      parts.push("", `### ${p.name || "פרסונה"}`, ...personaLines(p, audience));
    }
  }

  if (input.journey && (input.journey.stages ?? []).length) {
    parts.push("", "## מסע לקוח", "", ...journeyLines(input.journey, audience));
  }

  if (input.sitemap && (input.sitemap.pages ?? []).length) {
    parts.push("", "## מפת אתר", "", ...sitemapLines(input.sitemap, audience));
  }

  return parts.join(NL).replace(/\n{3,}/g, "\n\n").trim() + NL;
}

/** True when the document would be empty (nothing published, no discovery), so
 *  the UI can disable the export instead of producing a blank page. */
export function specIsEmpty(input: SpecInput): boolean {
  return (
    (input.discovery ?? []).filter((d) => (d.answer ?? "").trim()).length === 0 &&
    (input.personas ?? []).length === 0 &&
    !(input.journey && (input.journey.stages ?? []).length) &&
    !(input.sitemap && (input.sitemap.pages ?? []).length)
  );
}
