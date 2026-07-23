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

// The studio's section + page vocabulary (from Ori's UX-ideas sheet). The AI uses
// these names when it fits, so sitemaps + section suggestions match how the studio
// actually characterises sites.
const SECTION_LIBRARY = [
  "האדר ופוטר: לוגו, תפריט, מגה תפריט, חיפוש, סטריפ התראות, אייקונים לגישה מהירה, כפתור וואטסאפ/חיוג, קישורי סושיאל, פוטר, מפת אתר.",
  "הירו ודף בית: כותרת מקדימה, כותרת ראשית, כותרת משנה, פסקת הסבר, ויז'ואל/מוקאפ מרכזי, כפתורי הנעה לפעולה (CTA), אזור יתרונות, Trust Factors, גלריית לפני ואחרי, קרוסלת המלצות, לוגואים של לקוחות, אזור וידאו, טיימליין, קוביות פוסטים.",
  "עמודי תדמית: אודות, סיפור העסק, שירות/תוכנית, יתרונות, תהליך עבודה (שלבים), מפרט, גלריה/פורטפוליו, סיפורי הצלחה, בלוג, פוסט בודד, שאלות נפוצות, צור קשר (טופס, מפה, סניפים).",
  "חנות: דף קטגוריה, דף מוצר (גלריית מוצר, מחיר, וריאציות, מפרט, הוספה לסל, מוצרים נוספים), סל קניות, תשלום (פרטים, משלוח, קופון), חשבון אישי, ווישליסט, היסטוריית הזמנות.",
  "עמודי חובה: הצהרת נגישות, תקנון, מדיניות פרטיות, עמוד 404.",
].join(NL);

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
    "5. שם: בחר שם פרטי ומשפחה ריאליסטיים ומגוונים. אסור להשתמש בשמות המשפחה הנפוצים והקלישאתיים כהן ולוי, ואסור שמות פלייסהולדר (ישראל ישראלי, יוסי כהן, דני לוי, ישראלה). יש מאות שמות משפחה ישראליים מכל העדות, גוון ביניהם ואל תחזור על אותו שם משפחה בין הפרסונות. דוגמאות למגוון (לא רק אלה): אלקיים, שגב, בן שושן, הראל, נחמיאס, טולדנו, אזולאי, רוזנברג, שטרן, עמר, זהבי, גולן, שריקי, אבירם, ברנע.",
    "6. עברית מדוברת וטבעית. אסור: מקף ארוך (—); באזזוורדס ('ערך מוסף', 'סינרגיה'); שלשות תארים; סימני קריאה מוגזמים; האנשה.",
    "כמה פרסונות לייצר:",
    "- זהה את קהלי היעד המובחנים מהשיחה, וייצר פרסונה לכל קהל מרכזי.",
    "- אם קהל היעד כולל גם גברים וגם נשים, ייצר גם פרסונה גבר וגם פרסונה אישה, כי העיצוב והקופי צריכים להתאים לשני המינים.",
    "- סך הכל 2 עד 3 פרסונות, מובחנות זו מזו. בלי כפילויות.",
    "לכל פרסונה מלא:",
    "- gender: 'male' או 'female'.",
    "- context: איך ומאיזה מכשיר הפרסונה מגיעה לאתר, ובאיזו תדירות (רלוונטי להחלטות עיצוב).",
    "- design_notes: המלצות עיצוב וקופי קונקרטיות עבור הפרסונה הזו (טון הכתיבה, אילו הוכחות/אמון היא צריכה לראות, סוג ה-CTA, מה קריטי שיופיע ראשון, רמת הפירוט). זה לשימוש המעצב בלבד, לא ללקוח.",
    "- how_we_help: פסקה קצרה בקול העסק של הלקוח (לא בקול הסטודיו) על איך העסק פותר לפרסונה הזו את הכאב.",
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

/** Same senior-UX brief, but for ONE persona the admin describes in free text
 *  (mode "persona_single"). The discovery call is optional background here ,
 *  the admin's description is the source of truth, so a persona can be added
 *  to a project that has no discovery call at all. */
function personaSinglePrompt(title: string, description: string, items: Item[], existingNames: string[]): string {
  const data = items
    .filter((i) => (i.answer ?? "").trim().length > 0)
    .map((i) => "- " + i.question + " " + i.answer.trim())
    .join(NL);

  return [
    "אתה מעצב UX/UI בכיר מאוד עם ניסיון של 15+ שנים, שבונה פרסונת משתמש אחת לקראת עיצוב אתר. אתה חושב כל הזמן איך כל פרט בפרסונה ישפיע בפועל על החלטות העיצוב והקופי.",
    "עקרונות עבודה (best practices לפרסונות UX):",
    "1. התיאור שהאדמין כתב הוא מקור האמת. הרחב אותו לפרסונה מלאה, אל תסתור אותו ואל תמציא עובדות שסותרות אותו. מה שחסר, גזור בזהירות מהתחום ומקהל היעד.",
    "2. כל שדה חייב להיות רלוונטי להחלטת עיצוב או קופי. בלי פרטים דקורטיביים.",
    "3. שלוש שכבות: זכירה (שם, גיל, ציטוט), הקשר ודמוגרפיה (תפקיד, מיקום, איך ומאיזה מכשיר הוא מגיע, תדירות), והתנהגות ופסיכולוגיה (מטרות, כאבים, מניעים, סגנון קבלת החלטות, רמת נוחות טכנולוגית).",
    "4. ריאליסטי וספציפי, לא קריקטורה ולא סטריאוטיפ.",
    "5. שם: בחר שם פרטי ומשפחה ריאליסטיים ומגוונים. אסור להשתמש בשמות המשפחה הנפוצים והקלישאתיים כהן ולוי, ואסור שמות פלייסהולדר (ישראל ישראלי, יוסי כהן, דני לוי, ישראלה). יש מאות שמות משפחה ישראליים מכל העדות. דוגמאות למגוון (לא רק אלה): אלקיים, שגב, בן שושן, הראל, נחמיאס, טולדנו, אזולאי, רוזנברג, שטרן, עמר, זהבי, גולן, שריקי, אבירם, ברנע.",
    existingNames.length
      ? "אסור לחזור על השמות של הפרסונות שכבר קיימות בפרויקט: " + existingNames.join(", ") + "."
      : "",
    "6. עברית מדוברת וטבעית. אסור: מקף ארוך (—); באזזוורדס ('ערך מוסף', 'סינרגיה'); שלשות תארים; סימני קריאה מוגזמים; האנשה.",
    "מלא גם:",
    "- gender: 'male' או 'female' (אם התיאור לא מציין, בחר מה שמתאים לתיאור).",
    "- context: איך ומאיזה מכשיר הפרסונה מגיעה לאתר, ובאיזו תדירות.",
    "- design_notes: המלצות עיצוב וקופי קונקרטיות עבור הפרסונה הזו. לשימוש המעצב בלבד, לא ללקוח.",
    "- how_we_help: פסקה קצרה בקול העסק של הלקוח (לא בקול הסטודיו) על איך העסק פותר לפרסונה הזו את הכאב.",
    "- quote: משפט אחד בגוף ראשון, בקול הפרסונה.",
    "פרטי העסק: " + title,
    "התיאור שהאדמין כתב על הפרסונה (מקור האמת):",
    description,
    data ? "רקע נוסף משיחת האפיון של הפרויקט (לא לסתור את התיאור למעלה):\n" + data : "",
    "החזר אובייקט JSON יחיד של פרסונה אחת לפי הסכימה, בלי טקסט נוסף.",
  ].filter(Boolean).join(NL);
}

async function generatePersonaSingle(
  apiKey: string,
  title: string,
  description: string,
  items: Item[],
  existingNames: string[],
) {
  const prompt = personaSinglePrompt(title, description, items, existingNames);
  const models = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];
  let lastStatus = 0;
  let lastReason = "";

  for (const model of models) {
    const generationConfig: Record<string, unknown> = {
      temperature: 0.9,
      maxOutputTokens: 4000,
      responseMimeType: "application/json",
      responseSchema: PERSONA_ITEM_SCHEMA,
    };
    if (model === "gemini-2.5-flash") {
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
      let persona: any;
      try {
        persona = JSON.parse(text);
      } catch {
        return { ok: false, status: 502, error: "התקבלה תשובה לא תקינה מה-AI. נסה שוב." };
      }
      if (!persona || typeof persona !== "object" || Array.isArray(persona) || !persona.name) {
        return { ok: false, status: 502, error: "לא נוצרה פרסונה. נסה שוב." };
      }
      return { ok: true, persona };
    }
    const detail = await res.text();
    console.error("gemini persona_single error", model, res.status, detail);
    lastStatus = res.status;
    try {
      lastReason = JSON.parse(detail)?.error?.message ?? detail;
    } catch {
      lastReason = detail;
    }
  }
  return {
    ok: false,
    status: 502,
    error: "ה-AI לא הצליח לענות (Gemini " + lastStatus + "): " + String(lastReason).slice(0, 300),
  };
}

async function generatePersonas(apiKey: string, title: string, items: Item[]) {
  const prompt = personaPrompt(title, items);
  const models = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];
  let lastStatus = 0;
  let lastReason = "";

  for (const model of models) {
    const generationConfig: Record<string, unknown> = {
      temperature: 0.9,
      maxOutputTokens: 8000,
      responseMimeType: "application/json",
      responseSchema: { type: "ARRAY", items: PERSONA_ITEM_SCHEMA },
    };
    if (model === "gemini-2.5-flash") {
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

function journeyPrompt(title: string, items: Item[], personasText: string): string {
  const data = items
    .filter((i) => (i.answer ?? "").trim().length > 0)
    .map((i) => "- " + i.question + " " + i.answer.trim())
    .join(NL);
  return [
    "אתה מעצב UX/UI בכיר מאוד (15+ שנים) שבונה מפת מסע לקוח (Customer Journey Map) לקראת עיצוב אתר, על בסיס שיחת אפיון.",
    "עקרונות: התבסס רק על מה שנאמר בשיחה, בלי להמציא. כל פרט חייב להשפיע על החלטת עיצוב או קופי. ריאליסטי ולא סטריאוטיפ. עברית מדוברת וטבעית, בלי מקף ארוך, בלי באזזוורדס, בלי סימני קריאה מוגזמים.",
    personasText
      ? "הלקוחות שעוברים את המסע הם הפרסונות הבאות. בסס את המסע עליהן, על המטרות, הכאבים וההתנהגות שלהן, כדי שהמסע יהיה מדויק:\n" + personasText
      : "",
    "בנה מסע של 4 עד 6 שלבים לפי סדר כרונולוגי, מהרגע שהלקוח נעשה מודע לצורך ועד אחרי ההמרה והשימור. התאם את שמות השלבים לעסק.",
    "לכל שלב מלא:",
    "- name: שם השלב.",
    "- goal: מה הלקוח רוצה להשיג בשלב הזה.",
    "- emotion: מילה או שתיים על איך הוא מרגיש בשלב הזה.",
    "- touchpoints: נקודות המגע (איפה ואיך הוא נתקל בעסק בשלב הזה).",
    "- pains: כאבים וחסמים בשלב הזה.",
    "- on_site: מה קורה באתר עצמו בשלב הזה, איזה עמוד או סקשן או רכיב או CTA משרת את השלב וכיצד האתר פותר אותו. זה המסע של הלקוח בתוך האתר.",
    "- actions: מה אני עושה (באתר או בשירות) כדי לעזור לו לעבור לשלב הבא. גוף ראשון יחיד, לא 'אנחנו'.",
    "בנוסף: title קצר למסע, ו-design_notes עם המלצות עיצוב וקופי כלליות למסע (פנימי, לא ללקוח).",
    "פרטי העסק: " + title,
    "מתוך שיחת האפיון:",
    data,
    "החזר אובייקט JSON יחיד לפי הסכימה, בלי טקסט נוסף.",
  ].filter(Boolean).join(NL);
}

const JOURNEY_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    stages: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          goal: { type: "STRING" },
          emotion: { type: "STRING" },
          touchpoints: { type: "ARRAY", items: { type: "STRING" } },
          pains: { type: "ARRAY", items: { type: "STRING" } },
          on_site: { type: "STRING" },
          actions: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["name", "goal", "emotion", "touchpoints", "pains", "on_site", "actions"],
      },
    },
    design_notes: { type: "STRING" },
  },
  required: ["title", "stages", "design_notes"],
};

async function generateJourney(apiKey: string, title: string, items: Item[], personasText: string) {
  const prompt = journeyPrompt(title, items, personasText);
  const models = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];
  let lastStatus = 0;
  let lastReason = "";
  for (const model of models) {
    const generationConfig: Record<string, unknown> = {
      temperature: 0.8,
      maxOutputTokens: 8000,
      responseMimeType: "application/json",
      responseSchema: JOURNEY_SCHEMA,
    };
    if (model === "gemini-2.5-flash") {
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
      let journey: any;
      try {
        journey = JSON.parse(text);
      } catch {
        return { ok: false, status: 502, error: "התקבלה תשובה לא תקינה מה-AI. נסה שוב." };
      }
      if (!journey || !Array.isArray(journey.stages) || journey.stages.length === 0) {
        return { ok: false, status: 502, error: "לא נוצר מסע. נסה שוב." };
      }
      return { ok: true, journey };
    }
    const detail = await res.text();
    console.error("gemini journey error", model, res.status, detail);
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

function sitemapPrompt(
  title: string,
  items: Item[],
  personasText: string,
  journeyText: string,
): string {
  const data = items
    .filter((i) => (i.answer ?? "").trim().length > 0)
    .map((i) => "- " + i.question + " " + i.answer.trim())
    .join(NL);
  return [
    "אתה מעצב UX/UI בכיר מאוד (15+ שנים) שבונה מפת אתר (Sitemap) לקראת עיצוב אתר, על בסיס שיחת אפיון, הפרסונות ומסע הלקוח.",
    "עקרונות: התבסס רק על מה שנאמר, בלי להמציא. כל עמוד וכל סקשן חייב לשרת פרסונה ושלב במסע הלקוח. עברית טבעית, בלי מקף ארוך, בלי באזזוורדס, בלי סימני קריאה מוגזמים.",
    "מה זה סקשן: בלוק תוכן שלם בעמוד (למשל 'אזור יתרונות', 'גלריית לפני ואחרי', 'אזור המלצות', 'תהליך עבודה', 'שאלות נפוצות', 'אזור הנעה לפעולה'). סקשן מורכב מאלמנטים (כותרת, טקסט, תמונה, קרוסלה, כפתור, אייקון). אל תציע לעולם אלמנט בודד בתור סקשן (לא 'קרוסלה', לא 'כפתור', לא 'תמונה', לא 'טקסט'), אלא את הסקשן השלם שהוא חלק ממנו (למשל 'אזור המלצות' ולא 'קרוסלה').",
    "תמיד כלול במפה עמוד בלוג, לצורכי SEO ו-AEO, גם אם לא עלה בשיחה. האדמין יחליט אם להשאיר.",
    personasText ? "הפרסונות של הפרויקט:\n" + personasText : "",
    journeyText ? "שלבי מסע הלקוח:\n" + journeyText : "",
    "אוצר מילים של סקשנים ועמודים נפוצים בסטודיו (השתמש בשמות האלה כשמתאים, לא רק בהם):\n" + SECTION_LIBRARY,
    "בנה עץ עמודים היררכי של עד שתי רמות: עמודים ראשיים, וכשצריך תת-עמודים מתחתם. גזור את העמודים והסקשנים ממה שהפרסונות צריכות ומהשלבים במסע.",
    "לכל עמוד מלא:",
    "- name: שם העמוד.",
    "- purpose: מטרת העמוד באתר.",
    "- sections: הסקשנים המרכזיים בעמוד, מסודרים בסדר האופטימלי לחוויה ולהמרה.",
    "- order_rationale: הסבר קצר (משפט או שניים) למה הסקשנים בעמוד מסודרים בסדר הזה, מה ההיגיון מאחורי הסדר.",
    "- serves: איזה שלב במסע או איזו פרסונה העמוד משרת בעיקר.",
    "- children: תת-עמודים אם יש. לכל תת-עמוד name, purpose, sections, serves. אם אין, החזר מערך ריק.",
    "בנוסף: title קצר למפה, ו-design_notes עם המלצות עיצוב וקופי כלליות (פנימי, לא ללקוח).",
    "פרטי העסק: " + title,
    "מתוך שיחת האפיון:",
    data,
    "החזר אובייקט JSON יחיד לפי הסכימה, בלי טקסט נוסף.",
  ].filter(Boolean).join(NL);
}

const SITEMAP_LEAF_SCHEMA = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING" },
    purpose: { type: "STRING" },
    sections: { type: "ARRAY", items: { type: "STRING" } },
    serves: { type: "STRING" },
  },
  required: ["name", "purpose", "sections", "serves"],
};

const SITEMAP_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    pages: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          purpose: { type: "STRING" },
          sections: { type: "ARRAY", items: { type: "STRING" } },
          order_rationale: { type: "STRING" },
          serves: { type: "STRING" },
          children: { type: "ARRAY", items: SITEMAP_LEAF_SCHEMA },
        },
        required: ["name", "purpose", "sections", "order_rationale", "serves", "children"],
      },
    },
    design_notes: { type: "STRING" },
  },
  required: ["title", "pages", "design_notes"],
};

async function generateSitemap(
  apiKey: string,
  title: string,
  items: Item[],
  personasText: string,
  journeyText: string,
) {
  const prompt = sitemapPrompt(title, items, personasText, journeyText);
  const models = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];
  let lastStatus = 0;
  let lastReason = "";
  for (const model of models) {
    const generationConfig: Record<string, unknown> = {
      temperature: 0.8,
      maxOutputTokens: 8000,
      responseMimeType: "application/json",
      responseSchema: SITEMAP_SCHEMA,
    };
    if (model === "gemini-2.5-flash") {
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
      let sitemap: any;
      try {
        sitemap = JSON.parse(text);
      } catch {
        return { ok: false, status: 502, error: "התקבלה תשובה לא תקינה מה-AI. נסה שוב." };
      }
      if (!sitemap || !Array.isArray(sitemap.pages) || sitemap.pages.length === 0) {
        return { ok: false, status: 502, error: "לא נוצרה מפת אתר. נסה שוב." };
      }
      return { ok: true, sitemap };
    }
    const detail = await res.text();
    console.error("gemini sitemap error", model, res.status, detail);
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

function personasToText(personas: any): string {
  const arr = Array.isArray(personas) ? personas : [];
  return arr
    .map(
      (p) =>
        "- " + (p?.name ?? "") + " (" + (p?.archetype ?? "") + "): " + (p?.summary ?? "") +
        (Array.isArray(p?.goals) && p.goals.length ? " | מטרות: " + p.goals.join(", ") : "") +
        (Array.isArray(p?.pains) && p.pains.length ? " | כאבים: " + p.pains.join(", ") : ""),
    )
    .join(NL);
}

function journeyToText(journey: any): string {
  return journey && Array.isArray(journey.stages)
    ? journey.stages.map((s: any) => "- " + (s?.name ?? "") + ": " + (s?.goal ?? "")).join(NL)
    : "";
}

// Flatten the sitemap's pages + sections so the copywriter knows exactly what to
// write for (same page + section names, in the same order).
function sitemapPagesText(sitemap: any): string {
  const pages = sitemap && Array.isArray(sitemap.pages) ? sitemap.pages : [];
  return pages
    .map((p: any) => {
      const secs = Array.isArray(p?.sections) ? p.sections.join(", ") : "";
      return "- עמוד: " + (p?.name ?? "") + " | סקשנים: " + secs;
    })
    .join(NL);
}

const VOICE_TEXT: Record<string, string> = {
  first_singular:
    "גוף הכתיבה: גוף ראשון יחיד (לשון 'אני'). זה עסק של אדם אחד, אז דבר בשם עצמך ביחיד ('אני מלווה', 'אצלי', 'הלקוחות שלי'). אל תשתמש ב'אנחנו' או 'אנו'.",
  first_plural:
    "גוף הכתיבה: גוף ראשון רבים (לשון 'אנחנו'). דבר בשם הצוות ('אנחנו מלווים', 'אצלנו', 'הלקוחות שלנו').",
  third:
    "גוף הכתיבה: גוף שלישי, בשם העסק ('{שם העסק} מלווה', 'ב{שם העסק}'). אל תשתמש ב'אני' או ב'אנחנו', תמיד התייחס לעסק בשמו.",
};

const TONE_TEXT: Record<string, string> = {
  warm: "טון: חם, אישי ואנושי. קרוב אל הקורא, בגובה העיניים.",
  professional: "טון: מקצועי, אמין ומדויק. ענייני, בלי התלהמות.",
  energetic: "טון: אנרגטי, שיווקי וממריץ. דוחף לפעולה עם ביטחון.",
  calm: "טון: רגוע, מרגיע ושליו. מרגיע חששות ומייצר תחושת ביטחון.",
  luxury: "טון: יוקרתי, מעודן ואיכותי. מדוד, נקי, בלי צעקנות.",
};

function copyPrompt(
  title: string,
  items: Item[],
  personasText: string,
  journeyText: string,
  sitemap: any,
  voice: string,
  tone: string,
): string {
  const data = items
    .filter((i) => (i.answer ?? "").trim().length > 0)
    .map((i) => "- " + i.question + " " + i.answer.trim())
    .join(NL);
  const voiceLine = VOICE_TEXT[voice] ?? VOICE_TEXT.first_singular;
  const toneLine = TONE_TEXT[tone] ?? TONE_TEXT.warm;
  return [
    "אתה קופירייטר בכיר + מהנדס פרומפטים בעברית (15+ שנים). המשימה: לכל עמוד ולכל סקשן במפת האתר, כתוב פרומפט מפורט ומוכן-לשימוש (בעברית) שהסטודיו יזין ל-AI כדי לייצר את התוכן של אותו סקשן. אתה כותב את הפרומפט שייצר את התוכן, לא את התוכן עצמו.",
    "כל פרומפט צריך להנחות ליצור תוכן שמקיים את עקרונות הקופירייטינג הבאים:",
    "עקרונות קופירייטינג (שהפרומפט מטמיע):",
    "1. בהירות לפני תחכום. משפטים קצרים וברורים.",
    "2. תועלת לפני פיצ'ר: לא 'מה זה עושה' אלא 'מה זה נותן ללקוח'.",
    "3. ספציפיות לפני כלליות: פרטים קונקרטיים מהעסק (מהאפיון), לא 'שירות מקצועי', 'איכות ללא פשרות', 'הבחירה הנכונה'. אל תמציא מספרים או עובדות שלא עלו בשיחה.",
    "4. שפת הלקוח: דבר במילים שקהל היעד משתמש בהן, ותגע בכאב וברצון האמיתיים שלו.",
    "5. רעיון אחד לכל סקשן, שמוביל את הקורא צעד קדימה להמרה.",
    "6. אסור: מקף ארוך (—), סימני קריאה, באזזוורדס ('ערך מוסף', 'סינרגיה', 'פתרונות', 'חוויה בלתי נשכחת', 'ללא פשרות', 'בלי פשרות'), קלישאות, שלשות תארים, האנשה.",
    "קול העסק: הפרומפט צריך להנחות לכתוב באופי הספציפי של העסק הזה כפי שעלה בשיחת האפיון, לא טון גנרי אחיד. שלב בכל פרומפט את הגוף והטון הבאים:",
    voiceLine,
    toneLine,
    "עקביות: כל הפרומפטים משתמשים באותו גוף (אני/אנחנו/שם העסק) ואותו טון, בלי לערבב.",
    "כל פרומפט חייב להנחות: פנייה אל הקורא בצורה ניטרלית או לשון רבים (הקהל גברים ונשים, לא רק 'אתה'), ובלי להשתמש בשם הפרסונה.",
    personasText
      ? "קהל היעד: הפרסונות הבאות מתארות איך קהל היעד נראה ומרגיש, מה המטרות והכאבים שלו. שלב בפרומפט את הכאב והרצון של הקהל. אזהרה: אל תשתמש בשם הפרסונה, הפרסונה היא ייצוג של הקהל ולא לקוח אמיתי.\n" + personasText
      : "",
    journeyText ? "שלבי מסע הלקוח (התאם כל פרומפט לשלב שהעמוד משרת):\n" + journeyText : "",
    "מבנה האתר (מפת האתר) שאתה כותב לו פרומפטים. כתוב פרומפט לכל עמוד ולכל סקשן:\n" + sitemapPagesText(sitemap),
    "התאם כל פרומפט לסוג הסקשן, אל תכפה מבנה אחיד:",
    "- הירו/דף בית: בקש כותרת ראשית ממוקדת-תועלת + תת-כותרת + טקסט כפתור (CTA).",
    "- קרוסלה/קוביות/גלריית פריטים: בקש מספר פריטים קצרים (כל אחד כותרת קצרה + משפט), וציין כמה.",
    "- אזור יתרונות: בקש 3 עד 5 יתרונות, כל אחד כותרת + משפט תועלת.",
    "- שאלות נפוצות: בקש 5 עד 8 שאלות ותשובות אמיתיות.",
    "- המלצות: בקש מבנה המלצה (שם, הקשר, ציטוט) בלי להמציא שמות אמיתיים.",
    "- אודות/סיפור/שירות/תהליך: בקש פסקה או פסקאות, וציין אורך ומה להדגיש.",
    "- גלריה/לוגואים/וידאו: אם אין צורך בקופי, אמור זאת במפורש, ובקש רק כיתובים קצרים אם רלוונטי.",
    "- אזור הנעה לפעולה/צור קשר: בקש משפט מוביל + CTA.",
    "כל פרומפט חייב לכלול: מה בדיוק לייצר וכמה, אורך משוער, הגוף והטון, קהל היעד והכאב/רצון שלו, הפרטים הקונקרטיים של העסק הרלוונטיים לסקשן, ואת האילוצים (בלי מקף ארוך, בלי סימני קריאה, בלי באזזוורדס, פנייה ניטרלית, בלי שם הפרסונה).",
    "כתוב פרומפט לכל אותם עמודים ואותם סקשנים כמו במפה, לפי אותם שמות ובאותו סדר.",
    "פרטי העסק: " + title,
    "מתוך שיחת האפיון:",
    data,
    "לכל סקשן החזר name (שם הסקשן כמו במפה) + prompt (הפרומפט המלא, מוכן להעתקה). בנוסף: title קצר, design_notes פנימי.",
    "החזר אובייקט JSON יחיד לפי הסכימה, בלי טקסט נוסף.",
  ].filter(Boolean).join(NL);
}

const COPY_SECTION_SCHEMA = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING" },
    // One ready-to-use generation PROMPT per section (admin tool, not client copy).
    prompt: { type: "STRING" },
  },
  required: ["name", "prompt"],
};

const COPY_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    pages: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          sections: { type: "ARRAY", items: COPY_SECTION_SCHEMA },
        },
        required: ["name", "sections"],
      },
    },
    design_notes: { type: "STRING" },
  },
  required: ["title", "pages", "design_notes"],
};

async function generateCopy(
  apiKey: string,
  title: string,
  items: Item[],
  personasText: string,
  journeyText: string,
  sitemap: any,
  voice: string,
  tone: string,
) {
  const prompt = copyPrompt(title, items, personasText, journeyText, sitemap, voice, tone);
  const models = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];
  let lastStatus = 0;
  let lastReason = "";
  for (const model of models) {
    const generationConfig: Record<string, unknown> = {
      temperature: 0.85,
      maxOutputTokens: 8000,
      responseMimeType: "application/json",
      responseSchema: COPY_SCHEMA,
    };
    if (model === "gemini-2.5-flash") {
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
      let copy: any;
      try {
        copy = JSON.parse(text);
      } catch {
        return { ok: false, status: 502, error: "התקבלה תשובה לא תקינה מה-AI. נסה שוב." };
      }
      if (!copy || !Array.isArray(copy.pages) || copy.pages.length === 0) {
        return { ok: false, status: 502, error: "לא נוצר קופי. נסה שוב." };
      }
      return { ok: true, copy };
    }
    const detail = await res.text();
    console.error("gemini copy error", model, res.status, detail);
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

function briefPrompt(title: string, items: Item[], personasText: string, sitemap: any): string {
  const data = items
    .filter((i) => (i.answer ?? "").trim().length > 0)
    .map((i) => "- " + i.question + " " + i.answer.trim())
    .join(NL);
  return [
    "אתה מנהל פרויקטים בסטודיו אתרים. המשימה: להכין ללקוח בריף לאיסוף החומרים והמידע העסקי שרק הלקוח יכול לספק, לכל עמוד באתר.",
    "חשוב מאוד: את הקופי (הכותרות והטקסטים השיווקיים) אני כותב בעצמי. אל תבקש מהלקוח קופי שיווקי: לא כותרות ראשיות, לא כותרות משנה, לא סלוגנים, לא טקסטי כפתורים, לא ניסוחים לאתר. בקש רק חומרי גלם ומידע עסקי אמיתי.",
    "מה כן לבקש (חומרים ומידע שרק הלקוח מחזיק):",
    "- לוגו וקבצי מותג (צבעים, גופנים) אם יש.",
    "- תמונות אמיתיות: של העסק, הצוות, מוצרים, גלריה או תיק עבודות, לפני ואחרי.",
    "- המלצות אמיתיות של לקוחות (הציטוט + שם + תפקיד או הקשר).",
    "- רשימת השירותים או המוצרים עם הפרטים האמיתיים (מה כולל כל אחד, מחיר אם רלוונטי).",
    "- שלבי תהליך העבודה האמיתיים של העסק.",
    "- אנשי צוות: תמונה + שם + תפקיד לכל אחד.",
    "- פרטי קשר: טלפון, אימייל, כתובת, שעות פעילות, קישורי רשתות.",
    "- הסמכות, תעודות, ותק, נתונים ומספרים אמיתיים.",
    "- טקסטים או חומרים קיימים שכבר יש ללקוח.",
    "לכל פריט מלא:",
    "- label: שם קצר וברור של מה שצריך מהלקוח (למשל 'לוגו', 'תמונות מהעסק', 'רשימת שירותים', 'המלצות לקוחות').",
    "- help: משפט אחד שמסביר בדיוק מה לספק ובאיזה פורמט או כמות (למשל 'קובץ לוגו באיכות גבוהה, רצוי PNG שקוף או וקטור', '4 עד 8 תמונות אופקיות באיכות גבוהה', '3 עד 5 המלצות, לכל אחת שם ותפקיד').",
    "- kind: 'text' למידע טקסטואלי, 'image' לתמונה בודדת, 'gallery' לכמה תמונות, 'file' לקובץ אחר (מסמך, מצגת).",
    "- required: true אם הפריט הכרחי, false אם נחמד שיהיה.",
    "- prefill: אם המידע כבר עלה בשיחת האפיון (למשל שעות פעילות, טלפון, רשימת שירותים, ותק, תיאור העסק), מלא כאן את המידע כטקסט מוכן, כדי שהלקוח רק יאשר או יתקן. אם המידע לא קיים בשיחה, או שהפריט הוא תמונה או קובץ, השאר prefill ריק.",
    personasText ? "קהל היעד (רק להקשר):\n" + personasText : "",
    "מבנה האתר (גזור פריטים לפי מה שכל עמוד צריך, לפי אותם שמות עמודים):\n" + sitemapPagesText(sitemap),
    "פרטים כלליים שמשמשים את כל האתר (לוגו, צבעי מותג, גופנים אם יש) שים פעם אחת בלבד, בעמוד הראשון.",
    "פרטי העסק: " + title,
    "מתוך שיחת האפיון (השתמש בזה גם כדי למלא prefill למה שכבר ידוע):",
    data,
    "בנוסף: title קצר (למשל 'החומרים לאתר'), design_notes פנימי.",
    "החזר אובייקט JSON יחיד לפי הסכימה, בלי טקסט נוסף.",
  ].filter(Boolean).join(NL);
}

const BRIEF_ITEM_SCHEMA = {
  type: "OBJECT",
  properties: {
    label: { type: "STRING" },
    help: { type: "STRING" },
    kind: { type: "STRING", enum: ["text", "image", "file", "gallery"] },
    required: { type: "BOOLEAN" },
    // Pre-filled answer for text items already known from the discovery call
    // (the client just confirms or fixes). Empty when unknown or for uploads.
    prefill: { type: "STRING" },
  },
  required: ["label", "help", "kind", "required"],
};

const BRIEF_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    pages: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          items: { type: "ARRAY", items: BRIEF_ITEM_SCHEMA },
        },
        required: ["name", "items"],
      },
    },
    design_notes: { type: "STRING" },
  },
  required: ["title", "pages", "design_notes"],
};

async function generateBrief(
  apiKey: string,
  title: string,
  items: Item[],
  personasText: string,
  sitemap: any,
) {
  const prompt = briefPrompt(title, items, personasText, sitemap);
  const models = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];
  let lastStatus = 0;
  let lastReason = "";
  for (const model of models) {
    const generationConfig: Record<string, unknown> = {
      temperature: 0.7,
      maxOutputTokens: 8000,
      responseMimeType: "application/json",
      responseSchema: BRIEF_SCHEMA,
    };
    if (model === "gemini-2.5-flash") {
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
      let brief: any;
      try {
        brief = JSON.parse(text);
      } catch {
        return { ok: false, status: 502, error: "התקבלה תשובה לא תקינה מה-AI. נסה שוב." };
      }
      if (!brief || !Array.isArray(brief.pages) || brief.pages.length === 0) {
        return { ok: false, status: 502, error: "לא נוצר בריף. נסה שוב." };
      }
      return { ok: true, brief };
    }
    const detail = await res.text();
    console.error("gemini brief error", model, res.status, detail);
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

function seoPrompt(title: string, items: Item[], personasText: string, sitemap: any): string {
  const data = items
    .filter((i) => (i.answer ?? "").trim().length > 0)
    .map((i) => "- " + i.question + " " + i.answer.trim())
    .join(NL);
  return [
    "אתה מומחה SEO ו-AEO בכיר לאתרים בעברית (15+ שנים). המשימה: לכל עמוד במפת האתר, בנה את בסיס ה-SEO וה-AEO שהסטודיו ישתמש בו בבניית האתר.",
    "עקרונות: התבסס על שיחת האפיון, הפרסונות ומפת האתר. עברית טבעית, בלי מקף ארוך, בלי באזזוורדס, בלי סימני קריאה. אל תמציא נתונים (טלפון, כתובת, מספרים) שלא עלו בשיחה, במקומם השאר פלייסהולדר בסוגריים מסולסלים (למשל {טלפון}, {כתובת}, {url}).",
    "לכל עמוד מלא:",
    "- slug: כתובת קצרה באנגלית, אותיות קטנות ומקפים (למשל 'about', 'services'). לדף הבית החזר '/' .",
    "- meta_title: כותרת מטא עד 60 תווים, כוללת את מילת המפתח המרכזית ואת שם העסק כשמתאים.",
    "- meta_description: תיאור מטא של 150 עד 160 תווים, עם הצעת ערך והזמנה עדינה לפעולה.",
    "- h1: כותרת H1 לעמוד, שונה מ-meta_title, ממוקדת בכוונת החיפוש של הגולש.",
    "- keywords: 4 עד 8 מילות או ביטויי מפתח בעברית שהקהל באמת מחפש (הצעות מבוססות שפת הקהל מהאפיון, לא נתוני נפח).",
    "- aeo_answer: פסקה של 40 עד 60 מילים שעונה ישירות ובצורה עובדתית על השאלה המרכזית של העמוד, כך שמנוע תשובות או AI יוכל לצטט אותה. בלי שיווקיות ובלי סופרלטיבים.",
    "- faqs: 3 עד 5 שאלות ותשובות אמיתיות שהקהל שואל, עם תשובות קצרות וברורות.",
    "- json_ld: קטע JSON-LD תקין (כמחרוזת אחת) לעמוד, לפי schema.org, כולל FAQPage שנבנה מה-faqs, ואם רלוונטי גם Service או Article. השתמש בערכים אמיתיים מהאפיון ובפלייסהולדרים למה שחסר.",
    "בנוסף, ברמת האתר: business_json_ld = קטע JSON-LD אחד לעסק (Organization, או LocalBusiness אם יש כתובת פיזית), עם שם העסק ופלייסהולדרים לטלפון, כתובת ו-URL אם אינם ידועים.",
    personasText ? "קהל היעד (לכוונת חיפוש ולמילות מפתח):\n" + personasText : "",
    "מבנה האתר (בנה SEO לכל עמוד, לפי אותם שמות עמודים):\n" + sitemapPagesText(sitemap),
    "פרטי העסק: " + title,
    "מתוך שיחת האפיון:",
    data,
    "בנוסף: title קצר (למשל 'בסיס SEO ו-AEO'), design_notes פנימי.",
    "החזר אובייקט JSON יחיד לפי הסכימה, בלי טקסט נוסף.",
  ].filter(Boolean).join(NL);
}

const SEO_PAGE_SCHEMA = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING" },
    slug: { type: "STRING" },
    meta_title: { type: "STRING" },
    meta_description: { type: "STRING" },
    h1: { type: "STRING" },
    keywords: { type: "ARRAY", items: { type: "STRING" } },
    aeo_answer: { type: "STRING" },
    faqs: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: { q: { type: "STRING" }, a: { type: "STRING" } },
        required: ["q", "a"],
      },
    },
    json_ld: { type: "STRING" },
  },
  required: ["name", "slug", "meta_title", "meta_description", "h1", "keywords", "aeo_answer", "faqs", "json_ld"],
};

const SEO_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    business_json_ld: { type: "STRING" },
    pages: { type: "ARRAY", items: SEO_PAGE_SCHEMA },
    design_notes: { type: "STRING" },
  },
  required: ["title", "business_json_ld", "pages", "design_notes"],
};

async function generateSeo(
  apiKey: string,
  title: string,
  items: Item[],
  personasText: string,
  sitemap: any,
) {
  const prompt = seoPrompt(title, items, personasText, sitemap);
  const models = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];
  let lastStatus = 0;
  let lastReason = "";
  for (const model of models) {
    // SEO output is heavy (per-page meta + FAQs + a full JSON-LD string), so it
    // needs a much larger token budget than the other modes or the JSON truncates.
    const generationConfig: Record<string, unknown> = {
      temperature: 0.7,
      maxOutputTokens: 32000,
      responseMimeType: "application/json",
      responseSchema: SEO_SCHEMA,
    };
    if (model === "gemini-2.5-flash") {
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
      let seo: any;
      try {
        seo = JSON.parse(text);
      } catch {
        return { ok: false, status: 502, error: "התקבלה תשובה לא תקינה מה-AI. נסה שוב." };
      }
      if (!seo || !Array.isArray(seo.pages) || seo.pages.length === 0) {
        return { ok: false, status: 502, error: "לא נוצר בסיס SEO. נסה שוב." };
      }
      return { ok: true, seo };
    }
    const detail = await res.text();
    console.error("gemini seo error", model, res.status, detail);
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

// Per-page AI helpers for the sitemap editor: task = "sections" | "reorder" | "subpages".
async function generateAssist(
  apiKey: string,
  task: string,
  ctx: { title: string; page: any; personasText: string; journeyText: string },
) {
  const p = ctx.page || {};
  const cur = Array.isArray(p.sections) ? p.sections.join(", ") : "";
  const base = [
    "פרטי העסק: " + (ctx.title || ""),
    ctx.personasText ? "פרסונות:\n" + ctx.personasText : "",
    ctx.journeyText ? "שלבי מסע:\n" + ctx.journeyText : "",
    "העמוד: " + (p.name || "") + " (מטרה: " + (p.purpose || "") + ", משרת: " + (p.serves || "") + ").",
    "אוצר מילים של סקשנים ועמודים נפוצים:\n" + SECTION_LIBRARY,
    "עברית טבעית, בלי מקף ארוך, בלי באזזוורדס.",
  ]
    .filter(Boolean)
    .join(NL);

  let prompt: string;
  let schema: any;
  if (task === "reorder") {
    prompt =
      base + NL +
      "הסקשנים הנוכחיים בעמוד: " + (cur || "אין") +
      ". סדר אותם מחדש בסדר האופטימלי לחוויית משתמש ולהמרה, בלי להוסיף או להסיר סקשנים, רק לסדר. החזר את הסקשנים בסדר החדש והסבר קצר להיגיון הסדר.";
    schema = {
      type: "OBJECT",
      properties: {
        sections: { type: "ARRAY", items: { type: "STRING" } },
        rationale: { type: "STRING" },
      },
      required: ["sections", "rationale"],
    };
  } else if (task === "subpages") {
    prompt =
      base + NL +
      "הצע תת-עמודים לעמוד הזה אם רלוונטי (למשל תחת שירותים, שירותים ספציפיים). לכל תת-עמוד name, purpose, sections, serves. אם לא צריך תת-עמודים, החזר מערך ריק.";
    schema = {
      type: "OBJECT",
      properties: { subpages: { type: "ARRAY", items: SITEMAP_LEAF_SCHEMA } },
      required: ["subpages"],
    };
  } else {
    prompt =
      base + NL +
      "הצע רשימת סקשנים מומלצים להוספה לעמוד הזה, שאינם כבר קיימים בו (הקיימים: " + (cur || "אין") +
      "). כל המלצה חייבת להיות סקשן שלם (בלוק תוכן, למשל 'אזור המלצות', 'גלריית לפני ואחרי', 'תהליך עבודה'), לא אלמנט בודד כמו קרוסלה, כפתור, תמונה או טקסט. השתמש באוצר המילים כשמתאים. החזר רק את שמות הסקשנים.";
    schema = {
      type: "OBJECT",
      properties: { sections: { type: "ARRAY", items: { type: "STRING" } } },
      required: ["sections"],
    };
  }

  const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];
  for (const model of models) {
    const generationConfig: Record<string, unknown> = {
      temperature: 0.7,
      maxOutputTokens: 2000,
      responseMimeType: "application/json",
      responseSchema: schema,
      thinkingConfig: { thinkingBudget: 0 },
    };
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
        data?.candidates?.[0]?.content?.parts?.map((x: any) => x?.text ?? "").join("") ?? "";
      try {
        return { ok: true, result: JSON.parse(text) };
      } catch {
        return { ok: false, status: 502, error: "התקבלה תשובה לא תקינה מה-AI. נסה שוב." };
      }
    }
    if (res.status !== 404) {
      console.error("gemini assist error", model, res.status, (await res.text()).slice(0, 200));
      break;
    }
  }
  return { ok: false, status: 502, error: "ה-AI לא הצליח לענות. נסה שוב." };
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

// ---------------------------------------------------------------------------
// mode="quote_ai": 4 AI assists for the admin quote builder (price, copy,
// scope_fill, upsells). The mechanical quote engine stays the source of
// truth: everything here is a SUGGESTION the admin applies through the
// existing builder handlers, never an automatic mutation. Unknown catalog
// ids returned by the model are filtered out client-side (src/lib/quote-ai.ts).
// ---------------------------------------------------------------------------

// Every quote_ai prompt spells this out instead of using the character
// itself, so the source file never contains an em dash glyph.
const EM_DASH_RULE = "אסור להשתמש בתו em dash (מקף ארוך, הסימן שדומה למקף רגיל אך ארוך יותר) בשום מקום בתשובה.";

function scopeLabelsText(labels: any): string {
  const arr = Array.isArray(labels) ? labels : [];
  return arr.map((l: any) => "- " + String(l ?? "")).join(NL);
}

function scopeItemsText(scope: any): string {
  const arr = Array.isArray(scope) ? scope : [];
  return arr.map((s: any) => "- " + (s?.label ?? "") + ": " + (s?.value ?? "")).join(NL);
}

function catalogText(catalog: any): string {
  const arr = Array.isArray(catalog) ? catalog : [];
  return arr
    .map(
      (c: any) =>
        "- id: " + (c?.id ?? "") + " | סוג: " + (c?.kind ?? "") + " | " + (c?.label ?? "") +
        (c?.desc ? " (" + c.desc + ")" : ""),
    )
    .join(NL);
}

function upsellCatalogText(upsells: any): string {
  const arr = Array.isArray(upsells) ? upsells : [];
  return arr
    .map((u: any) => "- id: " + (u?.id ?? "") + " | " + (u?.label ?? "") + (u?.desc ? " (" + u.desc + ")" : ""))
    .join(NL);
}

function quotePricePrompt(payload: any): string {
  const scopeText = scopeItemsText(payload?.scope);
  const options = payload?.options || {};
  const type = String(payload?.type ?? "");
  const subtype = String(payload?.subtype ?? "");
  return [
    "אתה יועץ תמחור בכיר לסטודיו אתרים ישראלי פרימיום, עסק בוטיק של איש אחד (סטודיו אורי גיא).",
    "המשימה: לחדד שלוש נקודות מחיר להצעת מחיר ללקוח, על בסיס היקף הפרויקט ומחיר בסיס מכני שכבר חושב.",
    "כללים: כל מחיר בשקלים חדשים, לפני מע״מ, מספר שלם. אסור לרדת מתחת לרצפה שנתונה בשום מחיר, אפילו לא ברמת ה'הוגן'. אפשר לחדד ולכוון קלות את הבסיס המכני לפי ההיגיון העסקי של ההיקף, אבל אל תשנה אותו דרמטית בלי סיבה טובה.",
    "סוג הפרויקט: " + type + (subtype ? " (" + subtype + ")" : "") +
      (payload?.client_business ? ", העסק של הלקוח: " + payload.client_business : ""),
    "היקף הפרויקט:\n" + (scopeText || "לא צויין"),
    "עוגן מחיר (anchor) שכבר חושב: " + String(payload?.anchor ?? ""),
    "האפשרויות הבסיסיות שכבר חושבו מכנית: הוגן " + (options?.fair ?? "") + ", מומלץ " +
      (options?.recommended ?? "") + ", פרימיום " + (options?.premium ?? "") + ".",
    "רצפת מחיר, לעולם לא לרדת מתחתיה: " + String(payload?.floor ?? ""),
    payload?.notes ? "הערות רקע מהאדמין:\n" + String(payload.notes) : "",
    "עבור כל אחת משלוש הרמות (fair, recommended, premium) החזר מחיר מעודכן ורציונל: משפט אחד קצר וברור, מנוסח כפנייה ללקוח (אפשר להראות ללקוח כמו שהוא), שמסביר למה המחיר הזה הוגן ביחס להיקף. הרציונל נכתב בקול של אורי: גוף ראשון יחיד (אני בונה, אני נותן), לעולם לא 'אנחנו'. בלי סימני קריאה, בלי באזזוורדס.",
    "בנוסף כתוב advice: 2 עד 3 משפטים לאורי (לא ללקוח) עם עצה איך להציג את המחיר בשיחה, על מה כדאי להדגיש ואיך להתמודד עם התנגדות מחיר צפויה.",
    EM_DASH_RULE,
    "החזר אובייקט JSON יחיד לפי הסכימה, בלי טקסט נוסף.",
  ].filter(Boolean).join(NL);
}

const QUOTE_PRICE_POINT_SCHEMA = {
  type: "OBJECT",
  properties: {
    price: { type: "INTEGER" },
    rationale: { type: "STRING" },
  },
  required: ["price", "rationale"],
};

const QUOTE_PRICE_SCHEMA = {
  type: "OBJECT",
  properties: {
    fair: QUOTE_PRICE_POINT_SCHEMA,
    recommended: QUOTE_PRICE_POINT_SCHEMA,
    premium: QUOTE_PRICE_POINT_SCHEMA,
    advice: { type: "STRING" },
  },
  required: ["fair", "recommended", "premium", "advice"],
};

async function generateQuotePrice(apiKey: string, payload: any) {
  const prompt = quotePricePrompt(payload);
  const models = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];
  let lastStatus = 0;
  let lastReason = "";
  for (const model of models) {
    const generationConfig: Record<string, unknown> = {
      temperature: 0.4,
      maxOutputTokens: 2000,
      responseMimeType: "application/json",
      responseSchema: QUOTE_PRICE_SCHEMA,
    };
    if (model === "gemini-2.5-flash") {
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
      let priced: any;
      try {
        priced = JSON.parse(text);
      } catch {
        return { ok: false, status: 502, error: "התקבלה תשובה לא תקינה מה-AI. נסה שוב." };
      }
      if (!priced?.fair?.price || !priced?.recommended?.price || !priced?.premium?.price) {
        return { ok: false, status: 502, error: "לא התקבל תמחור מלא. נסה שוב." };
      }
      // Safety net: clamp to the floor server-side too, regardless of the
      // model's compliance with the prompt instruction.
      const floor = Number(payload?.floor);
      if (Number.isFinite(floor)) {
        priced.fair.price = Math.max(Math.round(priced.fair.price), floor);
        priced.recommended.price = Math.max(Math.round(priced.recommended.price), floor);
        priced.premium.price = Math.max(Math.round(priced.premium.price), floor);
      }
      return { ok: true, data: priced };
    }
    const detail = await res.text();
    console.error("gemini quote_ai price error", model, res.status, detail);
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

function quoteCopyPrompt(payload: any): string {
  const type = String(payload?.type ?? "");
  const subtype = String(payload?.subtype ?? "");
  const scopeText = scopeLabelsText(payload?.scope_labels);
  return [
    "אתה כותב בקול הכתיבה האישי של אורי גיא, בעל סטודיו אתרים בוטיק. אתה כותב פסקת פתיחה קצרה שתופיע בהצעת מחיר, פונה ישירות ללקוח.",
    "כללי הקול של אורי: גוף ראשון יחיד ('אני בונה', 'אני מלווה', 'אצלי'). לעולם לא 'אנחנו'. עברית חמה ופשוטה, קרובה וישירה, בלי באזזוורדס ובלי מילים גדולות. בלי סימני קריאה. " + EM_DASH_RULE,
    "אורך: 2 עד 4 משפטים בלבד. הטקסט חייב להיות ספציפי לפרויקט הזה ולא ניסוח גנרי שמתאים לכל לקוח.",
    "סוג הפרויקט: " + type + (subtype ? " (" + subtype + ")" : ""),
    payload?.client_name ? "שם הלקוח: " + String(payload.client_name) : "",
    payload?.client_business ? "העסק של הלקוח: " + String(payload.client_business) : "",
    scopeText ? "מה כלול בהיקף הפרויקט:\n" + scopeText : "",
    payload?.notes ? "הערות רקע מהאפיון עם הלקוח:\n" + String(payload.notes) : "",
    "כתוב פסקת פתיחה חמה להצעת המחיר, שמראה שהבנת בדיוק מה הלקוח צריך ולמה הפרויקט הזה מתאים לו באופן אישי.",
    "החזר אובייקט JSON יחיד לפי הסכימה, בלי טקסט נוסף.",
  ].filter(Boolean).join(NL);
}

const QUOTE_COPY_SCHEMA = {
  type: "OBJECT",
  properties: { narrative: { type: "STRING" } },
  required: ["narrative"],
};

async function generateQuoteCopy(apiKey: string, payload: any) {
  const prompt = quoteCopyPrompt(payload);
  const models = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];
  let lastStatus = 0;
  let lastReason = "";
  for (const model of models) {
    const generationConfig: Record<string, unknown> = {
      temperature: 0.7,
      maxOutputTokens: 1000,
      responseMimeType: "application/json",
      responseSchema: QUOTE_COPY_SCHEMA,
    };
    if (model === "gemini-2.5-flash") {
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
      let copy: any;
      try {
        copy = JSON.parse(text);
      } catch {
        return { ok: false, status: 502, error: "התקבלה תשובה לא תקינה מה-AI. נסה שוב." };
      }
      if (!copy?.narrative || !String(copy.narrative).trim()) {
        return { ok: false, status: 502, error: "לא נוצר ניסוח. נסה שוב." };
      }
      return { ok: true, data: copy };
    }
    const detail = await res.text();
    console.error("gemini quote_ai copy error", model, res.status, detail);
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

function quoteScopeFillPrompt(payload: any): string {
  const type = String(payload?.type ?? "");
  const catalog = catalogText(payload?.catalog);
  return [
    "אתה עוזר לאדמין של סטודיו אתרים למלא את היקף הפרויקט בהצעת מחיר, על בסיס סיכום שיחת אפיון עם הלקוח.",
    "כלל ברזל: מותר לבחור אך ורק מזהים (id) שמופיעים ברשימת הקטלוג הנתונה למטה, בדיוק כפי שהם כתובים. אסור להמציא id שלא ברשימה, ואסור לבחור פריט שלא באמת מתאים למה שעלה בשיחה.",
    "סוג הפרויקט: " + type + ".",
    "קטלוג הפריטים הזמינים (id, סוג, שם, ותיאור אם יש):\n" + (catalog || "אין קטלוג זמין"),
    "סיכום שיחת האפיון עם הלקוח:\n" + String(payload?.notes ?? ""),
    "המשימה הראשונה: אם סוג הפרויקט הוא website ויש בקטלוג פריט מסוג subtype שמתאים למה שעלה בשיחה, בחר subtype_id אחד בלבד. אם סוג הפרויקט אינו website, או שאין תת-סוג מתאים בקטלוג, החזר subtype_id כמחרוזת ריקה.",
    "המשימה השנייה: בחר מתוך הקטלוג את כל הפריטים (עמודים, פיצ'רים, מודולים, אוטומציות, לפי מה שקיים בקטלוג) שבאמת מתאימים להיקף שעלה בשיחה. אל תבחר פריטים לא רלוונטיים רק כדי למלא, ואל תפספס פריטים שברור מהשיחה שהלקוח צריך.",
    "כתוב reasoning: הסבר קצר וברור, לאדמין ולא ללקוח, למה נבחר מה שנבחר.",
    EM_DASH_RULE,
    "החזר אובייקט JSON יחיד לפי הסכימה, בלי טקסט נוסף.",
  ].filter(Boolean).join(NL);
}

const QUOTE_SCOPE_FILL_SCHEMA = {
  type: "OBJECT",
  properties: {
    subtype_id: { type: "STRING" },
    item_ids: { type: "ARRAY", items: { type: "STRING" } },
    reasoning: { type: "STRING" },
  },
  required: ["item_ids", "reasoning"],
};

async function generateQuoteScopeFill(apiKey: string, payload: any) {
  const prompt = quoteScopeFillPrompt(payload);
  const models = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];
  let lastStatus = 0;
  let lastReason = "";
  for (const model of models) {
    // The catalog can run to ~90 rows, so this needs a generous token budget
    // or the JSON output truncates before item_ids closes.
    const generationConfig: Record<string, unknown> = {
      temperature: 0.3,
      maxOutputTokens: 8000,
      responseMimeType: "application/json",
      responseSchema: QUOTE_SCOPE_FILL_SCHEMA,
    };
    if (model === "gemini-2.5-flash") {
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
      let filled: any;
      try {
        filled = JSON.parse(text);
      } catch {
        return { ok: false, status: 502, error: "התקבלה תשובה לא תקינה מה-AI. נסה שוב." };
      }
      if (!filled || !Array.isArray(filled.item_ids)) {
        return { ok: false, status: 502, error: "לא התקבל מילוי היקף תקין. נסה שוב." };
      }
      filled.subtype_id = String(filled.subtype_id ?? "");
      return { ok: true, data: filled };
    }
    const detail = await res.text();
    console.error("gemini quote_ai scope_fill error", model, res.status, detail);
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

function quoteUpsellsPrompt(payload: any): string {
  const upsellsList = upsellCatalogText(payload?.upsells);
  const scopeText = scopeLabelsText(payload?.scope_labels);
  return [
    "אתה עוזר לאדמין של סטודיו אתרים להציע תוספות (upsells) רלוונטיות ללקוח בתוך הצעת מחיר.",
    "כלל ברזל: מותר להציע אך ורק תוספות שהמזהה (id) שלהן מופיע ברשימה הנתונה למטה, בדיוק כפי שהוא כתוב. אסור להמציא id שלא ברשימה.",
    "רשימת התוספות הזמינות (id, שם, ותיאור אם יש):\n" + (upsellsList || "אין תוספות זמינות"),
    scopeText ? "מה כבר כלול בהיקף הפרויקט:\n" + scopeText : "",
    payload?.client_business ? "העסק של הלקוח: " + String(payload.client_business) : "",
    payload?.notes ? "סיכום שיחת האפיון עם הלקוח:\n" + String(payload.notes) : "",
    "בחר בין 0 ל-3 תוספות שבאמת מתאימות ללקוח הזה, על בסיס העסק שלו וההיקף שכבר סוכם. אל תציע תוספת רק כדי למכור עוד, רק אם היא באמת רלוונטית. אם אף תוספת לא מתאימה, החזר picks כמערך ריק.",
    "לכל תוספת שנבחרה כתוב reason: משפט קצר בעברית, פנייה שאפשר להראות ללקוח, שמסביר למה היא מתאימה לו. כתוב בקול של אורי: גוף ראשון יחיד (אני מוסיף, אני בונה), לעולם לא 'אנחנו'. בלי סימני קריאה, בלי באזזוורדס.",
    EM_DASH_RULE,
    "החזר אובייקט JSON יחיד לפי הסכימה, בלי טקסט נוסף.",
  ].filter(Boolean).join(NL);
}

const QUOTE_UPSELLS_SCHEMA = {
  type: "OBJECT",
  properties: {
    picks: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          id: { type: "STRING" },
          reason: { type: "STRING" },
        },
        required: ["id", "reason"],
      },
    },
  },
  required: ["picks"],
};

async function generateQuoteUpsells(apiKey: string, payload: any) {
  const prompt = quoteUpsellsPrompt(payload);
  const models = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];
  let lastStatus = 0;
  let lastReason = "";
  for (const model of models) {
    const generationConfig: Record<string, unknown> = {
      temperature: 0.5,
      maxOutputTokens: 2000,
      responseMimeType: "application/json",
      responseSchema: QUOTE_UPSELLS_SCHEMA,
    };
    if (model === "gemini-2.5-flash") {
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
      let picked: any;
      try {
        picked = JSON.parse(text);
      } catch {
        return { ok: false, status: 502, error: "התקבלה תשובה לא תקינה מה-AI. נסה שוב." };
      }
      if (!picked || !Array.isArray(picked.picks)) {
        return { ok: false, status: 502, error: "לא התקבלו הצעות תוספת תקינות. נסה שוב." };
      }
      return { ok: true, data: picked };
    }
    const detail = await res.text();
    console.error("gemini quote_ai upsells error", model, res.status, detail);
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

// action="order": reorder the scope items (pages + features, or modules /
// automations) into the logical sequence they'd appear on the deliverable, so
// the client's quote reads top-to-bottom like the real site's flow. Never adds,
// removes, or renames , only returns a permutation of the given ids.
function quoteOrderPrompt(payload: any): string {
  const items: any[] = Array.isArray(payload?.items) ? payload.items : [];
  const byKind: Record<string, any[]> = {};
  for (const it of items) {
    const k = String(it?.kind ?? "");
    (byKind[k] ??= []).push(it);
  }
  const KIND_HE: Record<string, string> = {
    page: "עמודים",
    feature: "פיצ'רים",
    module: "מודולים",
    automation: "אוטומציות",
  };
  const blocks = Object.entries(byKind).map(([kind, arr]) => {
    const lines = arr
      .map((it) => `- id=${it.id} | ${String(it.label ?? "")}${it.desc ? " , " + String(it.desc) : ""}`)
      .join(NL);
    return `${KIND_HE[kind] ?? kind}:\n${lines}`;
  });
  return [
    "אתה עוזר לאדמין של סטודיו אתרים לסדר את הפריטים בהצעת מחיר לפי הסדר ההגיוני שבו הם יופיעו בתוצר עצמו (דף הנחיתה / האתר).",
    "כלל ברזל: אסור להוסיף, למחוק או לשנות פריטים. החזר בדיוק את אותם ה-id שקיבלת, כל אחד פעם אחת, רק בסדר אחר.",
    "עמודים: סדר לפי זרימה טבעית של דף נחיתה או אתר, מלמעלה למטה: בית / הירו קודם, אחר כך אודות, שירותים או מוצרים, גלריה או תיק עבודות, המלצות, מחירון, שאלות נפוצות, וצור קשר בסוף. אם עמוד לא מתאים לתבנית, מקם אותו במקום ההגיוני ביותר.",
    "פיצ'רים / מודולים / אוטומציות: סדר לפי חשיבות והיגיון, מהמרכזי והבסיסי אל המשלים.",
    payload?.notes ? "הקשר, סיכום שיחת האפיון של הלקוח:\n" + String(payload.notes).slice(0, 6000) : "",
    "הפריטים לסידור (לפי קבוצות):\n" + (blocks.join(NL + NL) || "אין פריטים"),
    "כתוב reasoning: משפט קצר לאדמין (לא ללקוח) שמסביר את הסדר שבחרת.",
    EM_DASH_RULE,
    "החזר אובייקט JSON יחיד לפי הסכימה, ב-ordered_ids את כל ה-id בסדר החדש, בלי טקסט נוסף.",
  ].filter(Boolean).join(NL);
}

const QUOTE_ORDER_SCHEMA = {
  type: "OBJECT",
  properties: {
    ordered_ids: { type: "ARRAY", items: { type: "STRING" } },
    reasoning: { type: "STRING" },
  },
  required: ["ordered_ids"],
};

async function generateQuoteOrder(apiKey: string, payload: any) {
  const prompt = quoteOrderPrompt(payload);
  const models = ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-latest"];
  let lastStatus = 0;
  let lastReason = "";
  for (const model of models) {
    const generationConfig: Record<string, unknown> = {
      temperature: 0.2,
      maxOutputTokens: 4000,
      responseMimeType: "application/json",
      responseSchema: QUOTE_ORDER_SCHEMA,
    };
    if (model === "gemini-2.5-flash") {
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
      let parsed: any;
      try {
        parsed = JSON.parse(text);
      } catch {
        return { ok: false, status: 502, error: "התקבלה תשובה לא תקינה מה-AI. נסה שוב." };
      }
      if (!parsed || !Array.isArray(parsed.ordered_ids)) {
        return { ok: false, status: 502, error: "לא התקבל סידור תקין. נסה שוב." };
      }
      return { ok: true, data: parsed };
    }
    const detail = await res.text();
    console.error("gemini quote_ai order error", model, res.status, detail);
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

  const mode = [
      "image", "journey", "sitemap", "sitemap_assist", "copy", "brief", "seo", "quote_ai", "persona_single",
    ].includes(body?.mode)
    ? body.mode
    : "personas";

  // One persona from the admin's own description. Unlike "personas" this does
  // NOT require a discovery call (the description is the source of truth), so
  // it's handled before the shared items-required guard below.
  if (mode === "persona_single") {
    const description = String(body?.description ?? "").trim().slice(0, 4000);
    if (!description) return json({ ok: false, error: "צריך לתאר את הפרסונה קודם." }, 400);
    const bg: Item[] = Array.isArray(body?.items) ? body.items : [];
    const names: string[] = Array.isArray(body?.existing_names)
      ? body.existing_names.map((n: any) => String(n ?? "").trim()).filter(Boolean).slice(0, 20)
      : [];
    const r = await generatePersonaSingle(
      apiKey,
      String(body?.title ?? "").slice(0, 200),
      description,
      bg.filter((i) => (i?.answer ?? "").trim().length > 0),
      names,
    );
    if (!r.ok) return json({ ok: false, error: r.error }, r.status ?? 502);
    return json({ ok: true, persona: r.persona });
  }

  if (mode === "quote_ai") {
    const action = String(body?.action ?? "");
    const payload = body?.payload ?? {};
    if (action === "price") {
      const r = await generateQuotePrice(apiKey, payload);
      if (!r.ok) return json({ ok: false, error: r.error }, r.status ?? 502);
      return json({ ok: true, data: r.data });
    }
    if (action === "copy") {
      const r = await generateQuoteCopy(apiKey, payload);
      if (!r.ok) return json({ ok: false, error: r.error }, r.status ?? 502);
      return json({ ok: true, data: r.data });
    }
    if (action === "scope_fill") {
      const r = await generateQuoteScopeFill(apiKey, payload);
      if (!r.ok) return json({ ok: false, error: r.error }, r.status ?? 502);
      return json({ ok: true, data: r.data });
    }
    if (action === "upsells") {
      const r = await generateQuoteUpsells(apiKey, payload);
      if (!r.ok) return json({ ok: false, error: r.error }, r.status ?? 502);
      return json({ ok: true, data: r.data });
    }
    if (action === "order") {
      const r = await generateQuoteOrder(apiKey, payload);
      if (!r.ok) return json({ ok: false, error: r.error }, r.status ?? 502);
      return json({ ok: true, data: r.data });
    }
    return json({ ok: false, error: "פעולת AI לא מוכרת." }, 400);
  }

  if (mode === "image") {
    if (!body?.persona) return json({ ok: false, error: "missing persona" }, 400);
    const service = createClient(supabaseUrl, serviceKey);
    const avatar_url = await generateImage(apiKey, body.persona, String(body?.project_id ?? ""), service);
    return json({ ok: true, avatar_url });
  }

  if (mode === "sitemap_assist") {
    const task = ["reorder", "subpages", "sections"].includes(body?.task) ? body.task : "sections";
    const a = await generateAssist(apiKey, task, {
      title: String(body?.title ?? ""),
      page: body?.page || {},
      personasText: personasToText(body?.personas),
      journeyText: journeyToText(body?.journey),
    });
    if (!a.ok) return json({ ok: false, error: a.error }, a.status ?? 502);
    return json({ ok: true, result: a.result });
  }

  const title = String(body?.title ?? "").slice(0, 200);
  const raw: Item[] = Array.isArray(body?.items) ? body.items : [];
  const items = raw.filter((i) => (i?.answer ?? "").trim().length > 0);
  if (items.length === 0) {
    return json({ ok: false, error: "אין תשובות אפיון לעבוד מהן. מלא את שיחת האפיון קודם." }, 400);
  }

  if (mode === "copy") {
    if (!body?.sitemap?.pages?.length) {
      return json({ ok: false, error: "צריך מפת אתר לפני יצירת קופי. צור מפת אתר קודם." }, 400);
    }
    const cp = await generateCopy(
      apiKey,
      title,
      items,
      personasToText(body?.personas),
      journeyToText(body?.journey),
      body.sitemap,
      String(body?.voice ?? "first_singular"),
      String(body?.tone ?? "warm"),
    );
    if (!cp.ok) return json({ ok: false, error: cp.error }, cp.status ?? 502);
    return json({ ok: true, copy: cp.copy });
  }

  if (mode === "brief") {
    if (!body?.sitemap?.pages?.length) {
      return json({ ok: false, error: "צריך מפת אתר לפני יצירת בריף. צור מפת אתר קודם." }, 400);
    }
    const br = await generateBrief(apiKey, title, items, personasToText(body?.personas), body.sitemap);
    if (!br.ok) return json({ ok: false, error: br.error }, br.status ?? 502);
    return json({ ok: true, brief: br.brief });
  }

  if (mode === "seo") {
    if (!body?.sitemap?.pages?.length) {
      return json({ ok: false, error: "צריך מפת אתר לפני יצירת בסיס SEO. צור מפת אתר קודם." }, 400);
    }
    const sr = await generateSeo(apiKey, title, items, personasToText(body?.personas), body.sitemap);
    if (!sr.ok) return json({ ok: false, error: sr.error }, sr.status ?? 502);
    return json({ ok: true, seo: sr.seo });
  }

  if (mode === "journey" || mode === "sitemap") {
    const personasText = personasToText(body?.personas);

    if (mode === "journey") {
      const jr = await generateJourney(apiKey, title, items, personasText);
      if (!jr.ok) return json({ ok: false, error: jr.error }, jr.status ?? 502);
      return json({ ok: true, journey: jr.journey });
    }

    const sm = await generateSitemap(apiKey, title, items, personasText, journeyToText(body?.journey));
    if (!sm.ok) return json({ ok: false, error: sm.error }, sm.status ?? 502);
    return json({ ok: true, sitemap: sm.sitemap });
  }

  const result = await generatePersonas(apiKey, title, items);
  if (!result.ok) return json({ ok: false, error: result.error }, result.status ?? 502);
  return json({ ok: true, personas: result.personas });
});
