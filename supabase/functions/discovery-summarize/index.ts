// discovery-summarize — writes an AI summary of a discovery call via Google AI
// Studio (Gemini). Admin-only. The frontend sends the Q&A items; we build a
// Hebrew prompt and return the generated text (the admin edits before saving).
//
// kind="client"     → short, warm client-facing summary (client-visible items)
// kind="follow_up"  → internal action-item bullets (all items)
//
// Secret: GEMINI_API_KEY (from Google AI Studio).

import { createClient } from "npm:@supabase/supabase-js@2";

const NL = String.fromCharCode(10);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface Item {
  question: string;
  answer: string;
  show?: boolean;
}

function buildPrompt(kind: string, title: string, items: Item[]): string {
  const lines = items
    .filter((i) => (i.answer ?? "").trim().length > 0)
    .map((i) => "- " + i.question + " " + i.answer.trim());
  const data = lines.join(NL);

  if (kind === "client") {
    return [
      "אתה כותב סיכום קצר, חם ומקצועי ללקוח של סטודיו עיצוב פרימיום, בעקבות שיחת אפיון.",
      "כתוב בעברית תקנית, בגוף ראשון רבים (אנחנו), 2-4 משפטים. טון אישי, מרגיע ומקצועי, בלי באזזוורדס.",
      "סכם בקצרה את מה שהבנו על העסק והמטרות, והוסף משפט על השלב הבא.",
      "אל תשתמש במקף ארוך. אל תמציא פרטים שלא נאמרו.",
      "פרטי הלקוח: " + title,
      "מתוך השיחה:",
      data,
      "החזר רק את טקסט הסיכום, בלי כותרת ובלי הקדמה.",
    ].join(NL);
  }
  return [
    "אתה עוזר לבעל סטודיו עיצוב לסכם נקודות פעולה פנימיות מתוך שיחת אפיון.",
    "כתוב בעברית רשימת תבליטים תמציתית (כל שורה מתחילה ב-•) של משימות, סיכונים, ודברים לברר או להכין, כולל הצעת מחיר אם רלוונטי.",
    "אל תשתמש במקף ארוך. אל תמציא פרטים שלא נאמרו.",
    "פרטי הלקוח: " + title,
    "מתוך השיחה:",
    data,
    "החזר רק את רשימת התבליטים.",
  ].join(NL);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Admin gate.
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ ok: false, error: "unauthorized" }, 401);
  const asUser = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: role } = await asUser.rpc("get_my_role");
  if (role !== "admin") return json({ ok: false, error: "forbidden" }, 403);

  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) return json({ ok: false, error: "מפתח ה-AI לא הוגדר (GEMINI_API_KEY)." }, 503);

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, error: "bad request" }, 400);
  }
  const kind = body?.kind === "follow_up" ? "follow_up" : "client";
  const title = String(body?.title ?? "").slice(0, 200);
  let items: Item[] = Array.isArray(body?.items) ? body.items : [];
  if (kind === "client") items = items.filter((i) => i?.show === true);
  items = items.filter((i) => (i?.answer ?? "").trim().length > 0);
  if (items.length === 0) {
    return json({ ok: false, error: "אין מספיק תוכן לסיכום. מלא תשובות (וסמן 'ללקוח' לסיכום הלקוח)." }, 400);
  }

  const prompt = buildPrompt(kind, title, items);

  try {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" +
        apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.6, maxOutputTokens: 700 },
        }),
      },
    );
    if (!res.ok) {
      const detail = await res.text();
      console.error("gemini error", res.status, detail);
      return json({ ok: false, error: "ה-AI לא הצליח לענות. נסה שוב." }, 502);
    }
    const data = await res.json();
    const text: string =
      data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") ?? "";
    if (!text.trim()) return json({ ok: false, error: "התקבל סיכום ריק. נסה שוב." }, 502);
    return json({ ok: true, text: text.trim() });
  } catch (e) {
    console.error("discovery-summarize error", String(e));
    return json({ ok: false, error: String(e) }, 500);
  }
});
