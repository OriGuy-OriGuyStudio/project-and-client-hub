// Vercel serverless function , server-side PDF of a project's spec.
//
// Why server-side: the browser's own print dialog clipped the RTL document at
// the page edge and stamped Chrome's header/footer (date, URL, page numbers)
// onto every page. Here we drive headless Chromium ourselves, so the page box,
// the margins, the fonts and the running footer are all under our control and
// the output is identical on every machine.
//
// Auth: the caller sends its Supabase access token. We verify it and read the
// data AS THAT USER (RLS applies), then require role = admin. No service-role
// key is involved, so this endpoint can never return more than the caller can
// already see in the app.

import { createClient } from "@supabase/supabase-js";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
// Underscore-prefixed, so Vercel treats it as a helper module and not as a
// route of its own. Extensionless import: the function is bundled at build
// time, which is how Vercel's TypeScript runtime resolves sibling modules.
import { buildSpecHtml, type SpecDoc } from "./_spec-html";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? "";

// Minimal local shapes instead of depending on @vercel/node, which pulls a
// large dependency tree (and, at the current version, known advisories) just
// to type two objects.
type VercelRequest = {
  method?: string;
  query: Record<string, string | string[] | undefined>;
  body?: Record<string, unknown>;
  headers: Record<string, string | string[] | undefined>;
};
type VercelResponse = {
  status: (code: number) => VercelResponse;
  json: (body: unknown) => void;
  send: (body: Buffer | string) => void;
  setHeader: (name: string, value: string) => void;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "method not allowed" });
  }
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return res.status(503).json({ error: "Supabase env vars missing on the server" });
  }

  const projectId = String((req.query.project ?? req.body?.project) ?? "").trim();
  const audience = String((req.query.mode ?? req.body?.mode) ?? "client") === "full" ? "full" : "client";
  const authHeader = req.headers.authorization;
  const token = String(Array.isArray(authHeader) ? authHeader[0] : authHeader ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  if (!projectId) return res.status(400).json({ error: "missing project" });
  if (!token) return res.status(401).json({ error: "unauthorized" });

  // Everything below runs with the CALLER's rights, never elevated.
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userRes, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userRes?.user) return res.status(401).json({ error: "unauthorized" });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userRes.user.id)
    .maybeSingle();
  if (profile?.role !== "admin") return res.status(403).json({ error: "forbidden" });

  let browser;
  try {
    const [{ data: project }, { data: deliverables }] = await Promise.all([
      supabase.from("projects").select("id, title, org_id").eq("id", projectId).maybeSingle(),
      supabase
        .from("project_deliverables")
        .select("kind, title, content, status, sort_order")
        .eq("project_id", projectId)
        .eq("status", "published")
        .order("sort_order", { ascending: true }),
    ]);
    if (!project) return res.status(404).json({ error: "project not found" });

    const [{ data: brand }, discovery] = await Promise.all([
      project.org_id
        ? supabase.from("client_brands").select("business_name").eq("org_id", project.org_id).maybeSingle()
        : Promise.resolve({ data: null }),
      fetchDiscovery(supabase, projectId, project.org_id),
    ]);

    const rows = deliverables ?? [];
    const doc: SpecDoc = {
      audience,
      projectTitle: project.title ?? "",
      businessName: brand?.business_name ?? null,
      discoveryTitle: discovery?.title ?? null,
      discovery: discovery?.items ?? [],
      personas: rows.filter((d) => d.kind === "persona").map((d) => d.content),
      journey: rows.find((d) => d.kind === "journey")?.content ?? null,
      sitemap: rows.find((d) => d.kind === "sitemap")?.content ?? null,
      generatedAt: new Date(),
    };

    const html = buildSpecHtml(doc);

    browser = await puppeteer.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
    const page = await browser.newPage();
    // `networkidle0` so the embedded webfont is applied before we snapshot;
    // without it the first page can render in a fallback face.
    await page.setContent(html, { waitUntil: ["load", "networkidle0"] });
    const pdf = await page.pdf({
      format: "a4",
      printBackground: true,
      // Our own margins; the running footer lives inside the bottom margin.
      margin: { top: "16mm", bottom: "18mm", left: "14mm", right: "14mm" },
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: `
        <div style="width:100%;padding:0 14mm;font-family:Arial,sans-serif;font-size:8pt;color:#8a8994;display:flex;justify-content:space-between;direction:rtl">
          <span>סטודיו אורי גיא</span>
          <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
        </div>`,
    });

    const filename = `spec-${audience}-${projectId.slice(0, 8)}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(Buffer.from(pdf));
  } catch (e) {
    console.error("spec-pdf failed", e);
    return res.status(500).json({ error: "PDF generation failed" });
  } finally {
    if (browser) await browser.close().catch(() => undefined);
  }
}

/** Mirrors useProjectDiscoveryItems: the call linked to this project, else the
 *  latest call of the project's business. */
async function fetchDiscovery(
  // Loosely typed on purpose: this file has no generated Database types (they
  // live under src/), and the queries here are read-only and narrow.
  supabase: any,
  projectId: string,
  orgId: string | null,
): Promise<{ title: string; items: { question: string; answer: string }[] } | null> {
  const pick = async (col: "project_id" | "org_id", val: string) => {
    const { data } = await supabase
      .from("discovery_sessions")
      .select("title, answers")
      .eq(col, val)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data;
  };

  const row = (await pick("project_id", projectId)) ?? (orgId ? await pick("org_id", orgId) : null);
  if (!row) return null;

  const answers = (row as { answers?: unknown }).answers;
  const items = Array.isArray(answers)
    ? (answers as { question?: string; answer?: string }[])
        .map((a) => ({ question: String(a?.question ?? "").trim(), answer: String(a?.answer ?? "").trim() }))
        .filter((a) => a.question && a.answer)
    : [];
  return { title: String((row as { title?: string }).title ?? ""), items };
}
