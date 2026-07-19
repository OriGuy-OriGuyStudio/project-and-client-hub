// The printable HTML for the project-spec PDF (rendered by headless Chromium
// in api/spec-pdf.ts). Self-contained: one document, A4 width, RTL, brand
// fonts pulled from the deployed site with a Hebrew webfont fallback.
//
// The client/full split is enforced HERE, in `internal()`: every studio-only
// field (design notes, section-order rationale) is emitted only for the full
// audience, so a client PDF can never carry internal guidance.

export type SpecDoc = {
  audience: "client" | "full";
  projectTitle: string;
  businessName: string | null;
  discoveryTitle: string | null;
  discovery: { question: string; answer: string }[];
  personas: any[];
  journey: any | null;
  sitemap: any | null;
  generatedAt: Date;
};

/** Absolute origin for the brand font files. Vercel gives us the deployment
 *  host; the custom domain is the fallback for local runs. */
const ORIGIN = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "https://orion.origuystudio.com";

const GREEN = "#8fae4e"; // brand green, darkened for ink on white
const INK = "#14131a";
const MUTED = "#4b4a55";
const FAINT = "#6b6a75";
const HAIR = "#e2e1e8";

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Multi-line plain text to paragraphs, so line breaks in an answer survive. */
function paras(s: unknown): string {
  const text = String(s ?? "").trim();
  if (!text) return "";
  return text
    .split(/\n+/)
    .map((p) => `<p>${esc(p.trim())}</p>`)
    .join("");
}

function list(items: unknown, title: string): string {
  const arr = (Array.isArray(items) ? items : []).map((i) => String(i ?? "").trim()).filter(Boolean);
  if (!arr.length) return "";
  return `<div class="sub"><span class="lbl">${esc(title)}</span><ul>${arr
    .map((i) => `<li>${esc(i)}</li>`)
    .join("")}</ul></div>`;
}

function row(label: string, value: unknown): string {
  const v = String(value ?? "").trim();
  return v ? `<p class="row"><span class="lbl">${esc(label)}:</span> ${esc(v)}</p>` : "";
}

export function buildSpecHtml(doc: SpecDoc): string {
  const internal = (label: string, value: unknown) =>
    doc.audience === "full" ? row(label, value) : "";

  const answered = (doc.discovery ?? []).filter((d) => d.answer?.trim());

  const discoveryHtml = answered.length
    ? `<section>
        <h2>סיכום שיחת האפיון</h2>
        ${doc.discoveryTitle ? `<p class="faint">${esc(doc.discoveryTitle)}</p>` : ""}
        ${answered
          .map(
            (d) => `<div class="qa keep">
              <p class="q">${esc(d.question)}</p>
              <div class="a">${paras(d.answer)}</div>
            </div>`,
          )
          .join("")}
      </section>`
    : "";

  const personasHtml = (doc.personas ?? []).length
    ? `<section>
        <h2>פרסונות</h2>
        ${doc.personas
          .map(
            (p: any) => `<article class="card keep">
              <h3>${esc(p?.name || "פרסונה")}</h3>
              ${row("ארכיטיפ", p?.archetype)}
              ${row("גיל", p?.age)}
              ${row("מיקום", p?.location)}
              ${paras(p?.summary)}
              ${p?.quote ? `<p class="quote">"${esc(p.quote)}"</p>` : ""}
              <div class="cols">
                ${list(p?.traits, "תכונות")}
                ${list(p?.goals, "מטרות")}
                ${list(p?.pains, "כאבים")}
                ${list(p?.motivations, "מניעים")}
              </div>
              ${row("הקשר שימוש", p?.context)}
              ${row("איך אנחנו עוזרים", p?.how_we_help)}
              ${internal("המלצות עיצוב וקופי (פנימי)", p?.design_notes)}
            </article>`,
          )
          .join("")}
      </section>`
    : "";

  const stages = (doc.journey?.stages ?? []) as any[];
  const journeyHtml = stages.length
    ? `<section>
        <h2>מסע לקוח</h2>
        ${stages
          .map(
            (s: any, i: number) => `<article class="card keep">
              <h3><span class="num">${i + 1}</span> ${esc(s?.name)}</h3>
              ${row("מטרה", s?.goal)}
              ${row("תחושה", s?.emotion)}
              ${row("באתר", s?.on_site)}
              <div class="cols">
                ${list(s?.touchpoints, "נקודות מגע")}
                ${list(s?.pains, "כאבים")}
                ${list(s?.actions, "מה אנחנו עושים")}
              </div>
            </article>`,
          )
          .join("")}
        ${internal("המלצות עיצוב (פנימי)", doc.journey?.design_notes)}
      </section>`
    : "";

  const pageHtml = (p: any, depth: number): string => `
    <div class="page-node ${depth === 0 ? "keep" : ""}" style="margin-inline-start:${depth * 14}px">
      <p class="pname">${depth > 0 ? "↳ " : ""}${esc(p?.name)}</p>
      ${row("מטרה", p?.purpose)}
      ${row("משרת", p?.serves)}
      ${
        Array.isArray(p?.sections) && p.sections.length
          ? `<p class="row"><span class="lbl">סקשנים:</span> ${p.sections.map(esc).join(" · ")}</p>`
          : ""
      }
      ${internal("למה בסדר הזה (פנימי)", p?.order_rationale)}
      ${(p?.children ?? []).map((c: any) => pageHtml(c, depth + 1)).join("")}
    </div>`;

  const pages = (doc.sitemap?.pages ?? []) as any[];
  const sitemapHtml = pages.length
    ? `<section>
        <h2>מפת אתר</h2>
        ${pages.map((p) => pageHtml(p, 0)).join("")}
        ${internal("המלצות עיצוב (פנימי)", doc.sitemap?.design_notes)}
      </section>`
    : "";

  const subtitle = [doc.businessName, doc.generatedAt.toLocaleDateString("he-IL")]
    .filter(Boolean)
    .join(" · ");

  return `<!doctype html>
<html dir="rtl" lang="he">
<head>
<meta charset="utf-8">
<title>אפיון הפרויקט</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;700;900&display=swap" rel="stylesheet">
<style>
  @font-face { font-family:"Kaha"; src:url("${ORIGIN}/fonts/kaha-black.woff2") format("woff2"); font-weight:900; font-display:block }
  @font-face { font-family:"Kaha"; src:url("${ORIGIN}/fonts/kaha-regular.woff2") format("woff2"); font-weight:400; font-display:block }
  @font-face { font-family:"Diplomat"; src:url("${ORIGIN}/fonts/diplomat-regular.woff2") format("woff2"); font-weight:400; font-display:block }
  @font-face { font-family:"Diplomat"; src:url("${ORIGIN}/fonts/diplomat-medium.woff2") format("woff2"); font-weight:500; font-display:block }

  * { box-sizing:border-box }
  html, body { margin:0; padding:0 }
  body {
    font-family:"Diplomat","Heebo",Arial,sans-serif;
    color:${INK};
    font-size:10.5pt;
    line-height:1.65;
    direction:rtl;
    text-align:right;
    /* No fixed width: the page box set by Puppeteer IS the width, which is
       what stops the RTL clipping the browser print dialog produced. */
  }
  h1,h2,h3 { font-family:"Kaha","Heebo",Arial,sans-serif; margin:0 }
  h1 { font-size:21pt; font-weight:900; line-height:1.2 }
  h2 {
    font-size:14pt; font-weight:900; margin:0 0 8px;
    padding-bottom:5px; border-bottom:2px solid ${GREEN};
    break-after:avoid; page-break-after:avoid;
  }
  h3 { font-size:11.5pt; font-weight:900; margin:0 0 4px }
  p { margin:0 0 5px }
  ul { margin:2px 0 0; padding-inline-start:16px }
  li { margin:0 0 2px }
  section { margin-top:20px }
  .keep { break-inside:avoid; page-break-inside:avoid }

  header { border-bottom:2.5px solid ${GREEN}; padding-bottom:10px; margin-bottom:4px }
  .eyebrow { font-size:8.5pt; font-weight:700; color:${FAINT}; letter-spacing:.03em; margin:0 0 3px }
  .sub { font-size:9.5pt; color:${MUTED} }
  .faint { color:${FAINT}; font-size:9.5pt; margin:0 0 8px }
  .badge {
    display:inline-block; margin-top:7px; padding:2px 9px; border-radius:999px;
    background:#fdf3d8; border:1px solid #e3c56a; color:#7a5a0b;
    font-size:8.5pt; font-weight:700;
  }

  .qa { margin:0 0 9px }
  .q { font-weight:700; margin:0 0 1px }
  .a { color:${MUTED} }
  .a p { margin:0 0 3px }

  .card { border:1px solid ${HAIR}; border-radius:9px; padding:11px 13px; margin:0 0 9px; background:#fcfcfd }
  .row { color:${MUTED} }
  .lbl { font-weight:700; color:${INK} }
  .quote { color:${FAINT}; font-style:italic; margin:5px 0 }
  .num {
    display:inline-block; min-width:19px; height:19px; line-height:19px; text-align:center;
    border-radius:999px; background:${GREEN}; color:#fff; font-size:9pt; margin-inline-end:5px;
  }
  /* Two columns for the short lists: same content, roughly half the pages. */
  .cols { column-count:2; column-gap:18px; margin-top:5px }
  .cols .sub { break-inside:avoid; margin-bottom:5px }

  .page-node { margin:0 0 7px; padding-inline-start:0 }
  .pname { font-weight:700; margin:0 0 2px }

  footer { margin-top:22px; padding-top:8px; border-top:1px solid ${HAIR}; color:${FAINT}; font-size:8.5pt }
</style>
</head>
<body>
  <header>
    <p class="eyebrow">סטודיו אורי גיא</p>
    <h1>אפיון הפרויקט: ${esc(doc.projectTitle || "ללא שם")}</h1>
    ${subtitle ? `<p class="sub">${esc(subtitle)}</p>` : ""}
    ${doc.audience === "full" ? `<span class="badge">מסמך פנימי, כולל הערות עבודה</span>` : ""}
  </header>

  ${discoveryHtml}
  ${personasHtml}
  ${journeyHtml}
  ${sitemapHtml}

  <footer>סטודיו אורי גיא · origuystudio.com</footer>
</body>
</html>`;
}
