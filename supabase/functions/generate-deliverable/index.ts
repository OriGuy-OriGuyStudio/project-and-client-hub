// generate-deliverable — AI tools for the "ארגז כלים" tab. Admin-only, Gemini.
// Reuses GEMINI_API_KEY (same as discovery-summarize).
//
// mode="personas": think like a senior UX/UI designer and turn a discovery call
//   into an ARRAY of client-ready personas (structured JSON). Covers each distinct
//   audience, and BOTH a male and a female persona when the audience is mixed, so
//   the design + copy fit everyone. Returns { ok, personas: [...] } (no avatar yet).
// mode="image": generate a realistic portrait for one persona, upload it to the
//   public `deliverable-media` bucket, and return { ok, avatar_url }.

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
}

// Senior-UX-designer brief for persona generation. Encodes the persona best
// practices: base ONLY on the discovery, three content layers, every field must
// drive a design/copy decision, realistic (not a caricature), no generic names.
function personaPrompt(title: string, items: Item[]): string {
  const data = items
    .filter((i) => (i.answer ?? "").trim().length > 0)
    .map((i) => "- " + i.question + " " + i.answer.trim())
    .join(NL);

  return [
    "אתה מעצב UX/UI בכיר מאוד עם ניסיון של 15+ שנים, שבונה פרסונות משתמש לקראת עיצוב אתר. אתה חושב כל הזמן איך כל פרט בפרסונה ישפיע בפועל על החלטות העיצוב והקופי.",
    "עקרונות עבודה (best practices לפרסונות UX):",
    "1. התבסס אך ורק על מה שנאמר בשיחת האפיון. אל תמציא עובדות ספציפיות שלא עלו. אם חסר מידע, גזור בזהירות מהתחום ומקהל היעד, בלי להמציא נתונים.",
    "2. כל שדה חייב להיות רלוונטי להחלטת עיצוב או קופי. בלי פרטים דקורטיביים.",
    "3. שלוש שכבות: זכירה (שם, גיל, ציטוט), הקשר ודמוגרפיה (תפקיד, מיקום, איך ומאיזה מכשיר הוא מגיע, תדירות), והתנהגות ופסיכולוגיה (מטרות, כאבים, מניעים, סגנון קבלת החלטות, רמת נוחות טכנולוגית).",
    "4. ריאליסטי וספציפי, לא קריקטורה ולא סטריאוטיפ.",
    "5. שם: בחר שם פרטי ומשפחה ריאליסטי שמתאים לפרסונה. אסור בתכלית שמות קלישאה או פלייסהולדר (יוסי כהן, ישראל ישראלי, דני לוי, משה חיים, ישראלה).",
    "6. עברית מדוברת וטבעית. אסור: מקף ארוך (—); באזזוורדס ('ערך מוסף', 'סינרגיה'); שלשות תארים; סימני קריאה מוגזמים; האנשה.",
    "כמה פרסונות לייצר:",
    "- זהה את קהלי היעד המובחנים מהשיחה, וייצר פרסונה לכל קהל מרכזי.",
    "- אם קהל היעד כולל גם גברים וגם נשים, ייצר גם פרסונה גבר וגם פרסונה אישה, כי העיצוב והקופי צריכים להתאים לשני המינים.",
    "- סך הכל 2 עד 3 פרסונות, מובחנות זו מזו. בלי כפילויות.",
    "לכל פרסונה מלא:",
    "- gender: 'male' או 'female'.",
    "- context: איך ומאיזה מכשיר הפרסונה מגיעה לאתר, ובאיזו תדירות (רלוונטי להחלטות עיצוב).",
    "- design_notes: המלצות עיצוב וקופי קונקרטיות עבור הפרסונה הזו (טון הכתיבה, אילו הוכחות/אמון היא צריכה לראות, סוג ה-CTA, מה קריטי שיופיע ראשון, רמת הפירוט). זה לשימוש המעצב בלבד, לא ללקוח.",
    "- how_we_help: פסקה קצרה בקול הסטודיו (לשון 'אני'/'אנחנו') על איך פותרים לפרסונה את הכאב.",
    "- quote: משפט אחד בגוף ראשון, בקול הפרסונה.",
    "פרטי העסק: " + title,
    "מתוך שיחת האפיון:",
    data,
    "החזר מערך JSON של פרסונות בלבד, לפי הסכימה, בלי טקסט נוסף.",
  ].join(NL);
}

const PERSONA_ITEM_SCHEMA = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING" },
    archetype: { type: "STRING" },
    gender: { type: "STRING", enum: ["male", "female"] },
    summary: { type: "STRING" },
    age: { type: "STRING" },
    location: { type: "STRING" },
    traits: { type: "ARRAY", items: { type: "STRING" } },
    quote: { type: "STRING" },
    goals: { type: "ARRAY", items: { type: "STRING" } },
    pains: { type: "ARRAY", items: { type: "STRING" } },
    motivations: { type: "ARRAY", items: { type: "STRING" } },
    context: { type: "STRING" },
    how_we_help: { type: "STRING" },
    design_notes: { type: "STRING" },
  },
  required: [
    "name", "archetype", "gender", "summary", "age", "location", "traits",
    "quote", "goals", "pains", "motivations", "context", "how_we_help", "design_notes",
  ],
};

async function generatePersonas(apiKey: string, title: string, items: Item[]) {
  const prompt = personaPrompt(title, items);
  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];
  let lastStatus = 0;
  let lastReason = "";

  for (const model of models) {
    const generationConfig: Record<string, unknown> = {
      temperature: 0.8,
      maxOutputTokens: 4000,
      responseMimeType: "application/json",
      responseSchema: { type: "ARRAY", items: PERSONA_ITEM_SCHEMA },
    };
    if (model.startsWith("gemini-2.5")) {
      generationConfig.thinkingConfig = { thinkingBudget: 0 };
    }
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig }),
      },
    );
    if (res.ok) {
      const data = await res.json();
      const text: string =
        data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text ?? "").join("") ?? "";
      let personas: any;
      try {
        personas = JSON.parse(text);
      } catch {
        return { ok: false, status: 502, error: "התקבלה תשובה לא תקינה מה-AI. נסה שוב." };
      }
      if (!Array.isArray(personas) || personas.length === 0) {
        return { ok: false, status: 502, error: "לא נוצרו פרסונות. נסה שוב." };
      }
      return { ok: true, personas: personas.slice(0, 3) };
    }
    const detail = await res.text();
    console.error("gemini persona error", model, res.status, detail);
    lastStatus = res.status;
    try {
      lastReason = JSON.parse(detail)?.error?.message ?? detail;
    } catch {
      lastReason = detail;
    }
    if (res.status !== 404) break;
  }
  return {
    ok: false,
    status: 502,
    error: "ה-AI לא הצליח לענות (Gemini " + lastStatus + "): " + lastReason.slice(0, 300),
  };
}

function imagePrompt(persona: any): string {
  const g = persona?.gender === "female" ? "woman" : "man";
  return [
    "A realistic, natural professional portrait photograph of a " + g + ".",
    "Person: " + (persona?.archetype ?? "") + ". " + (persona?.summary ?? ""),
    "Age: " + (persona?.age ?? "") + ". Context: " + (persona?.context ?? "") + ".",
    "Warm, approachable, authentic. Soft natural light, plain neutral background.",
    "Head and shoulders, looking at camera. No text, no logo, no watermark, photorealistic.",
  ].join(" ");
}

async function generateImage(apiKey: string, persona: any, projectId: string, service: any) {
  const prompt = imagePrompt(persona);
  const models = ["gemini-2.5-flash-image", "gemini-2.0-flash-preview-image-generation"];
  for (const model of models) {
    const res = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ["TEXT", "IMAGE"] },
        }),
      },
    );
    if (!res.ok) {
      console.error("gemini image error", model, res.status, (await res.text()).slice(0, 300));
      continue;
    }
    const data = await res.json();
    const parts: any[] = data?.candidates?.[0]?.content?.parts ?? [];
    const img = parts.find((p) => p?.inlineData?.data);
    if (!img) continue;
    const bytes = Uint8Array.from(atob(img.inlineData.data), (c) => c.charCodeAt(0));
    const path = "personas/" + (projectId || "adhoc") + "/" + crypto.randomUUID() + ".png";
    const { error: upErr } = await service.storage
      .from("deliverable-media")
      .upload(path, bytes, { contentType: img.inlineData.mimeType || "image/png", upsert: true });
    if (upErr) {
      console.error("storage upload error", upErr.message);
      return null;
    }
    const { data: pub } = service.storage.from("deliverable-media").getPublicUrl(path);
    return pub?.publicUrl ?? null;
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Admin gate (same pattern as discovery-summarize).
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader) return json({ ok: false, error: "unauthorized" }, 401);
  const asUser = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
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

  const mode = body?.mode === "image" ? "image" : "personas";

  if (mode === "image") {
    if (!body?.persona) return json({ ok: false, error: "missing persona" }, 400);
    const service = createClient(supabaseUrl, serviceKey);
    const avatar_url = await generateImage(apiKey, body.persona, String(body?.project_id ?? ""), service);
    return json({ ok: true, avatar_url });
  }

  const title = String(body?.title ?? "").slice(0, 200);
  const raw: Item[] = Array.isArray(body?.items) ? body.items : [];
  const items = raw.filter((i) => (i?.answer ?? "").trim().length > 0);
  if (items.length === 0) {
    return json({ ok: false, error: "אין תשובות אפיון לעבוד מהן. מלא את שיחת האפיון קודם." }, 400);
  }

  const result = await generatePersonas(apiKey, title, items);
  if (!result.ok) return json({ ok: false, error: result.error }, result.status ?? 502);
  return json({ ok: true, personas: result.personas });
});
