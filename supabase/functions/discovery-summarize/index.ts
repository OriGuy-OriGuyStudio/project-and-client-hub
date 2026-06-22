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

  // Shared base rules (from the /human-voice-copywriting skill): natural spoken
  // Hebrew, no m-dashes, no buzzwords, no AI-flavored openers, no invention.
  const BASE = [
    "כתוב בעברית מדוברת וטבעית, כמו שאדם אמיתי מדבר, לא עברית רשמית או שיווקית.",
    "אסור בתכלית: מקף ארוך (—); הפתיחות 'בעולם של היום' / 'בעידן הדיגיטלי' / 'אין ספק ש'; באזזוורדס כמו 'ערך מוסף' או 'סינרגיה'; שלשות תארים ('חדשני, יצירתי ומקצועי'); סימני קריאה מוגזמים; האנשה ('האתר עובד קשה בשבילך'); סיומות גנריות ('נשמח לעמוד לרשותכם').",
    "התבסס רק על מה שמולא, גם אם המידע חלקי. אל תמציא פרטים שלא נאמרו.",
  ].join(NL);

  if (kind === "client") {
    return [
      "אתה כותב בשמו של אורי, מעצב אתרים שעובד לבד, סיכום ללקוח בעקבות שיחת אפיון.",
      BASE,
      "דבר על עצמך בלשון יחיד ('אני', 'העסק שלי'), לא 'אנחנו'. פנה ללקוח בגוף שני, בטון חם ואישי אבל ענייני.",
      "כתוב פסקה זורמת של 5-8 משפטים. מותר משפט פתיחה אישי קצר, אבל מיד עבור לתוכן. חובה לכסות בפועל את מה שמולא: מי העסק ומה הוא עושה, קהל היעד, המטרות, ומה הכי חשוב ללקוח, וסיים במשפט על השלב הבא. אל תסתפק במשפט נימוסים, תסכם את המהות.",
      "פרטי הלקוח: " + title,
      "מתוך השיחה:",
      data,
      "החזר רק את טקסט הסיכום, בלי כותרת ובלי הקדמה.",
    ].join(NL);
  }
  return [
    "אתה עוזר לאורי לסכם לעצמו, לשימוש פנימי בלבד, נקודות פעולה מתוך שיחת אפיון. הטקסט הזה לא נשלח ללקוח.",
    BASE,
    "כתוב רשימת תבליטים יבשה ועניינית (כל שורה מתחילה ב-•): משימות, סיכונים, דברים לברר או להכין לקראת העבודה.",
    "אל תפנה ללקוח, אל תכתוב ברכות או נימוסים ('היי', 'כיף לדבר איתך'), ואל תכתוב פסקת פתיחה או סיכום. רק תבליטים ענייניים.",
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
  const raw: Item[] = Array.isArray(body?.items) ? body.items : [];
  // Always feed the AI EVERY filled answer (for both kinds) so it has the full
  // picture to compose from — the admin reviews and edits before saving, and the
  // "ללקוח" flag only controls what shows on the public page, not what the AI sees.
  const items: Item[] = raw.filter((i) => (i?.answer ?? "").trim().length > 0);
  if (items.length === 0) {
    return json({ ok: false, error: "אין תשובות לסכם. מלא לפחות תשובה אחת ונסה שוב." }, 400);
  }

  const prompt = buildPrompt(kind, title, items);

  // gemini-2.0-flash first: reliable, fast, and has no "thinking" budget that can
  // eat the output tokens (gemini-2.5-* think by default and would truncate the
  // summary). 2.5 is kept as a fallback with thinking turned OFF.
  const models = ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-flash-latest"];
  let lastStatus = 0;
  let lastReason = "";

  try {
    for (const model of models) {
      const generationConfig: Record<string, unknown> = {
        temperature: 0.7,
        maxOutputTokens: 1200,
      };
      // 2.5 models think by default; disable it so the full summary fits.
      if (model.startsWith("gemini-2.5")) {
        generationConfig.thinkingConfig = { thinkingBudget: 0 };
      }
      const res = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/" +
          model +
          ":generateContent?key=" +
          apiKey,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig,
          }),
        },
      );

      if (res.ok) {
        const data = await res.json();
        const text: string =
          data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") ?? "";
        if (!text.trim()) return json({ ok: false, error: "התקבל סיכום ריק. נסה שוב." }, 502);
        return json({ ok: true, text: text.trim() });
      }

      const detail = await res.text();
      console.error("gemini error", model, res.status, detail);
      lastStatus = res.status;
      try {
        lastReason = JSON.parse(detail)?.error?.message ?? detail;
      } catch {
        lastReason = detail;
      }
      // 404 = model not available for this key; try the next model. Anything else
      // (bad key, quota, etc.) won't be fixed by switching models, so stop.
      if (res.status !== 404) break;
    }

    return json(
      {
        ok: false,
        error: "ה-AI לא הצליח לענות (Gemini " + lastStatus + "): " + lastReason.slice(0, 300),
      },
      502,
    );
  } catch (e) {
    console.error("discovery-summarize error", String(e));
    return json({ ok: false, error: String(e) }, 500);
  }
});
