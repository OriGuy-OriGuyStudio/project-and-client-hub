// site-insights — AI (Gemini) performance/security/UX review for a maintenance
// package. Admin-only. Reads the site's latest metrics AND fetches the live page
// (title, meta, headings, text) so it can also suggest content/feature ideas.
// Returns { assessment, recommendations: [{area, text}] } for the studio to be
// proactive with the client.
//
// Secret: GEMINI_API_KEY (Google AI Studio).

import { createClient } from "npm:@supabase/supabase-js@2";

const NL = String.fromCharCode(10);
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

// Best-effort: fetch the page and pull a light content summary for the AI.
async function pageSummary(url: string): Promise<string> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "OrionBot/1.0" } });
    clearTimeout(t);
    if (!r.ok) return "";
    const html = (await r.text()).slice(0, 200000);
    const pick = (re: RegExp) => (html.match(re)?.[1] ?? "").replace(/\s+/g, " ").trim();
    const title = pick(/<title[^>]*>([^<]*)<\/title>/i);
    const desc = pick(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)["']/i);
    const heads = [...html.matchAll(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
      .map((m) => m[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .slice(0, 12);
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 1500);
    return [
      title && `כותרת: ${title}`,
      desc && `תיאור: ${desc}`,
      heads.length && `כותרות: ${heads.join(" | ")}`,
      text && `טקסט (קטע): ${text}`,
    ].filter(Boolean).join(NL);
  } catch {
    return "";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ ok: false, error: "unauthorized" }, 401);
  const asUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: role } = await asUser.rpc("get_my_role");
  if (role !== "admin") return json({ ok: false, error: "forbidden" }, 403);

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return json({ ok: false, error: "מפתח ה-AI לא הוגדר (GEMINI_API_KEY)." }, 503);

  let body: { project_id?: string };
  try { body = await req.json(); } catch { return json({ ok: false, error: "bad request" }, 400); }
  const projectId = String(body?.project_id ?? "").trim();
  if (!projectId) return json({ ok: false, error: "missing project_id" }, 400);

  const admin = createClient(supabaseUrl, serviceKey);
  const { data: ps } = await admin.from("project_service").select("tier, site_type, site_url").eq("project_id", projectId).maybeSingle();
  const { data: proj } = await admin.from("projects").select("title").eq("id", projectId).maybeSingle();
  const { data: metrics } = await admin.from("site_metrics").select("*").eq("project_id", projectId).order("metric_date", { ascending: false }).limit(7);
  if (!ps) return json({ ok: false, error: "no package for this project" }, 404);

  const latest = (metrics ?? [])[0] ?? {};
  const avg = (k: string) => {
    const vals = (metrics ?? []).map((m: Record<string, number>) => m[k]).filter((v) => v != null);
    return vals.length ? Math.round((vals.reduce((a, b) => a + Number(b), 0) / vals.length) * 100) / 100 : null;
  };
  const content = ps.site_url ? await pageSummary(ps.site_url) : "";

  const metricsBlock = [
    `אתר: ${proj?.title ?? ""} (${ps.site_url ?? "ללא כתובת"})`,
    `חבילה: ${ps.tier} · סוג: ${ps.site_type}`,
    latest.pagespeed != null && `PageSpeed (מובייל): ${latest.pagespeed} (ממוצע 7י ${avg("pagespeed")})`,
    latest.lcp_ms != null && `LCP: ${(latest.lcp_ms / 1000).toFixed(1)}s`,
    latest.cls != null && `CLS: ${latest.cls}`,
    latest.inp_ms != null && `INP: ${latest.inp_ms}ms`,
    latest.uptime_pct != null && `זמינות: ${latest.uptime_pct}%`,
    latest.threats_blocked != null && `איומים שנחסמו (יום): ${latest.threats_blocked}`,
    latest.visitors != null && `מבקרים (יום): ${latest.visitors}`,
  ].filter(Boolean).join(NL);

  const prompt = [
    "אתה יועץ ביצועים, אבטחה וחווית משתמש של סטודיו אתרים פרימיום (אורי גיא), שכותב לאורי עצמו כדי שיהיה יוזם מול הלקוח.",
    "כתוב בעברית מדוברת וטבעית. אסור: מקף ארוך (—), באזזוורדס ('ערך מוסף', 'סינרגיה'), פתיחות גנריות, סימני קריאה מוגזמים, האנשה, להמציא נתונים שלא נמסרו.",
    "בסס את עצמך על המדדים ועל תוכן העמוד שמצורף. אם חסר מידע, אל תמציא, פשוט התמקד במה שיש.",
    "החזר JSON תקין בלבד במבנה: {\"assessment\": string, \"recommendations\": [{\"area\": string, \"text\": string}]}.",
    "assessment = 2-3 משפטים על מצב האתר. recommendations = 3 עד 5 המלצות קונקרטיות וממוקדות לשיפור/ייעול/פיצ'רים; area הוא אחד מ: מהירות, אבטחה, UX, תוכן, פיצ'רים; text = פעולה ברורה ומעשית (לא כללית).",
    "== מדדים ==",
    metricsBlock,
    content ? "== תוכן העמוד ==" : "",
    content,
  ].filter(Boolean).join(NL);

  const models = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-flash-latest"];
  let lastStatus = 0, lastReason = "";
  try {
    for (const model of models) {
      const generationConfig: Record<string, unknown> = { temperature: 0.6, maxOutputTokens: 1200, responseMimeType: "application/json" };
      if (model.startsWith("gemini-2.5")) generationConfig.thinkingConfig = { thinkingBudget: 0 };
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig }) },
      );
      if (res.ok) {
        const data = await res.json();
        const text: string = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p?.text ?? "").join("") ?? "";
        try {
          const parsed = JSON.parse(text);
          return json({ ok: true, assessment: parsed.assessment ?? "", recommendations: parsed.recommendations ?? [], fetchedPage: !!content });
        } catch {
          return json({ ok: true, assessment: text.trim(), recommendations: [], fetchedPage: !!content });
        }
      }
      const detail = await res.text();
      console.error("gemini error", model, res.status, detail);
      lastStatus = res.status;
      try { lastReason = JSON.parse(detail)?.error?.message ?? detail; } catch { lastReason = detail; }
      if (res.status !== 404) break;
    }
    return json({ ok: false, error: `ה-AI לא הצליח לענות (Gemini ${lastStatus}): ${lastReason.slice(0, 300)}` }, 502);
  } catch (e) {
    console.error("site-insights error", String(e));
    return json({ ok: false, error: String(e) }, 500);
  }
});
