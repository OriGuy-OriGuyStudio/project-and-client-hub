// telegram-webhook — turns a Telegram message into an admin task on the board.
//
// Ori messages his private bot from his phone and a task is created in
// admin_tasks (no app login, no email spam). Telegram POSTs every update here.
//
// Message format (first line required, the rest optional, any order):
//   <urgency?> <title>          e.g. "דחוף לתקן באג בצ׳קאאוט"
//   פרויקט: <שם פרויקט>          links the project (+ derives its client)
//   קבוצה: <שם קבוצה>            links a group, creating it if it doesn't exist
//   <anything else>             becomes the note
//
// Auth (verify_jwt is OFF — Telegram can't send a Supabase JWT):
//   1. setWebhook secret_token echoed in X-Telegram-Bot-Api-Secret-Token,
//      checked against TELEGRAM_WEBHOOK_SECRET.
//   2. Only TELEGRAM_ALLOWED_CHAT_ID may create tasks. /start & /id reply the id.
//
// Secrets: TELEGRAM_BOT_TOKEN, TELEGRAM_WEBHOOK_SECRET, TELEGRAM_ALLOWED_CHAT_ID.

import { createClient } from "npm:@supabase/supabase-js@2";

const NL = String.fromCharCode(10);

const URGENCY: Record<string, string> = {
  "דחוף": "urgent",
  "דחופה": "urgent",
  "גבוה": "high",
  "גבוהה": "high",
  "בינוני": "medium",
  "בינונית": "medium",
  "נמוך": "low",
  "נמוכה": "low",
};

const PROJECT_KEYS = ["פרויקט", "פרוייקט", "project"];
const GROUP_KEYS = ["קבוצה", "סבב", "group"];
const NOTE_KEYS = ["הערה", "note"];

// Returns the value if `line` starts with one of `keys` followed by a colon.
function labelValue(line: string, keys: string[]): string | null {
  const low = line.toLowerCase();
  for (const key of keys) {
    for (const sep of [":", "："]) {
      const prefix = (key + sep).toLowerCase();
      if (low.startsWith(prefix)) return line.slice(key.length + sep.length).trim();
    }
  }
  return null;
}

async function tg(method: string, token: string, body: unknown) {
  return await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function ok() {
  return new Response("ok", { status: 200 });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return ok();

  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
  const allowedChat = Deno.env.get("TELEGRAM_ALLOWED_CHAT_ID");
  if (!token) return ok();

  if (
    webhookSecret &&
    req.headers.get("x-telegram-bot-api-secret-token") !== webhookSecret
  ) {
    return new Response("forbidden", { status: 401 });
  }

  let update: any;
  try {
    update = await req.json();
  } catch {
    return ok();
  }

  const msg = update?.message ?? update?.edited_message;
  const text: string = msg?.text?.trim() ?? "";
  const chatId = msg?.chat?.id != null ? String(msg.chat.id) : "";
  if (!chatId || !text) return ok();

  const reply = (t: string) => tg("sendMessage", token, { chat_id: chatId, text: t });

  if (text === "/start" || text === "/id" || text === "/help") {
    await reply(
      [
        "ברוך הבא ללוח המשימות של Orion 🟢",
        "ה-chat id שלך: " + chatId,
        "",
        "להוספת משימה שלח טקסט. שורה ראשונה = שם המשימה.",
        "מילה ראשונה דחוף/גבוה/בינוני/נמוך = דחיפות (לא חובה).",
        "אפשר להוסיף שורות:",
        "פרויקט: <שם הפרויקט>",
        "קבוצה: <שם הקבוצה> (תיווצר אם לא קיימת)",
        "וכל שאר הטקסט = הערה.",
        "",
        "לדוגמה:",
        "דחוף לתקן באג בצ׳קאאוט",
        "פרויקט: הרמלין",
        "קבוצה: סבב תיקונים 3",
        "הלקוח דיווח שהכפתור לא עובד",
      ].join(NL),
    );
    return ok();
  }

  if (!allowedChat) {
    await reply(
      "הבוט עדיין לא הוגדר. הוסף את ה-chat id הזה כ-TELEGRAM_ALLOWED_CHAT_ID:" + NL + chatId,
    );
    return ok();
  }
  if (chatId !== allowedChat) {
    await reply("אין לך הרשאה להוסיף משימות לבוט הזה.");
    return ok();
  }

  // --- Parse ------------------------------------------------------------------
  const lines = text.split(NL);
  let firstLine = lines[0].trim();
  let urgency = "medium";
  const firstWord = firstLine.split(" ").filter(Boolean)[0];
  if (firstWord && URGENCY[firstWord]) {
    urgency = URGENCY[firstWord];
    firstLine = firstLine.slice(firstWord.length).trim();
  }
  const title = firstLine.slice(0, 200);
  if (!title) {
    await reply("לא הצלחתי לקרוא שם משימה. נסה שוב.");
    return ok();
  }

  let projectQuery = "";
  let groupName = "";
  const noteLines: string[] = [];
  for (const raw of lines.slice(1)) {
    const line = raw.trim();
    if (!line) continue;
    const p = labelValue(line, PROJECT_KEYS);
    const g = labelValue(line, GROUP_KEYS);
    const n = labelValue(line, NOTE_KEYS);
    if (p !== null) projectQuery = p;
    else if (g !== null) groupName = g;
    else if (n !== null) noteLines.push(n);
    else noteLines.push(line);
  }
  const note = noteLines.join(NL).slice(0, 2000) || null;

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // --- Resolve project (by title or the client's business name) ---------------
  let projectId: string | null = null;
  let clientId: string | null = null;
  let projectLabel = "";
  if (projectQuery) {
    const q = projectQuery.toLowerCase();
    const [{ data: projs }, { data: brands }] = await Promise.all([
      admin.from("projects").select("id, title, client_id"),
      admin.from("client_brand").select("client_id, business_name"),
    ]);
    const bizByClient = new Map<string, string>(
      (brands ?? []).map((b: any) => [b.client_id, b.business_name ?? ""]),
    );
    const match = (projs ?? []).find((p: any) => {
      const names = [String(p.title ?? ""), String(bizByClient.get(p.client_id) ?? "")]
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
      return names.some((n) => n === q || n.includes(q) || q.includes(n));
    });
    if (match) {
      projectId = match.id;
      clientId = match.client_id;
      projectLabel = bizByClient.get(match.client_id) || match.title || "";
    }
  }

  // --- Resolve / create group -------------------------------------------------
  let groupId: string | null = null;
  if (groupName) {
    const { data: existing } = await admin
      .from("admin_task_groups")
      .select("id, title");
    const g = (existing ?? []).find(
      (x: any) => String(x.title).trim().toLowerCase() === groupName.toLowerCase(),
    );
    if (g) {
      groupId = g.id;
    } else {
      const { data: created } = await admin
        .from("admin_task_groups")
        .insert({ title: groupName, order_index: (existing ?? []).length })
        .select("id")
        .single();
      groupId = created?.id ?? null;
    }
  }

  // --- Create the task --------------------------------------------------------
  const { error } = await admin.from("admin_tasks").insert({
    title,
    urgency,
    note,
    project_id: projectId,
    client_id: clientId,
    group_id: groupId,
    status: "todo",
    order_index: Math.floor(Date.now() / 1000),
  });
  if (error) {
    await reply("שמירת המשימה נכשלה. נסה שוב מאוחר יותר.");
    return ok();
  }

  const urgHe =
    urgency === "urgent" ? "דחוף" : urgency === "high" ? "גבוהה" : urgency === "low" ? "נמוכה" : "בינונית";
  const extra: string[] = [];
  if (projectLabel) extra.push("פרויקט: " + projectLabel);
  else if (projectQuery) extra.push('פרויקט "' + projectQuery + '" לא נמצא');
  if (groupName) extra.push("קבוצה: " + groupName);
  await reply(
    "✅ נוספה משימה (" + urgHe + "):" + NL + title +
      (extra.length ? NL + extra.join(NL) : ""),
  );
  return ok();
});
