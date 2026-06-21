// telegram-webhook — turns a Telegram message into an admin task on the board.
//
// Ori messages his private bot from his phone and a task is created in
// admin_tasks (no app login, no email spam). Telegram POSTs every update here.
//
// Auth (verify_jwt is OFF — Telegram can't send a Supabase JWT):
//   1. setWebhook is registered with a `secret_token`; Telegram echoes it in the
//      `X-Telegram-Bot-Api-Secret-Token` header, which we check against
//      TELEGRAM_WEBHOOK_SECRET.
//   2. Only messages from TELEGRAM_ALLOWED_CHAT_ID create tasks. `/start` and
//      `/id` always reply with the chat id so Ori can configure that value.
//
// Secrets (set in the Supabase dashboard): TELEGRAM_BOT_TOKEN,
// TELEGRAM_WEBHOOK_SECRET, TELEGRAM_ALLOWED_CHAT_ID.

import { createClient } from "npm:@supabase/supabase-js@2";

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

async function tg(method: string, token: string, body: unknown) {
  return await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function ok() {
  // Always 200 so Telegram doesn't retry.
  return new Response("ok", { status: 200 });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return ok();

  const token = Deno.env.get("TELEGRAM_BOT_TOKEN");
  const webhookSecret = Deno.env.get("TELEGRAM_WEBHOOK_SECRET");
  const allowedChat = Deno.env.get("TELEGRAM_ALLOWED_CHAT_ID");
  if (!token) return ok();

  // 1) Verify the request really came from Telegram's webhook.
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

  const reply = (t: string) =>
    tg("sendMessage", token, { chat_id: chatId, text: t });

  // 2) Onboarding helpers — always available so Ori can find his chat id.
  if (text === "/start" || text === "/id" || text === "/help") {
    await reply(
      [
        "ברוך הבא ללוח המשימות של Orion 🟢",
        `ה-chat id שלך: ${chatId}`,
        "",
        "כדי להוסיף משימה — פשוט שלח טקסט:",
        "• שורה ראשונה = שם המשימה",
        "• מילה ראשונה דחוף/גבוה/בינוני/נמוך = דחיפות (לא חובה)",
        "• שורות נוספות = הערה",
        "",
        'לדוגמה:\nדחוף לתקן באג בצ׳קאאוט\nהלקוח דיווח שהכפתור לא עובד',
      ].join("\n"),
    );
    return ok();
  }

  // 3) Only the authorized chat may create tasks.
  if (!allowedChat) {
    await reply(
      `הבוט עדיין לא הוגדר. הוסף את ה-chat id הזה כ-TELEGRAM_ALLOWED_CHAT_ID:\n${chatId}`,
    );
    return ok();
  }
  if (chatId !== allowedChat) {
    await reply("אין לך הרשאה להוסיף משימות לבוט הזה.");
    return ok();
  }

  // 4) Parse: optional leading urgency word, first line = title, rest = note.
  const lines = text.split("\n");
  let firstLine = lines[0].trim();
  let urgency = "medium";
  const firstWord = firstLine.split(/\s+/)[0];
  if (firstWord && URGENCY[firstWord]) {
    urgency = URGENCY[firstWord];
    firstLine = firstLine.slice(firstWord.length).trim();
  }
  const title = firstLine.slice(0, 200);
  const note = lines.slice(1).join("\n").trim().slice(0, 2000) || null;
  if (!title) {
    await reply("לא הצלחתי לקרוא שם משימה. נסה שוב.");
    return ok();
  }

  // 5) Create the task (service role bypasses the admin-only RLS).
  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { error } = await admin.from("admin_tasks").insert({
    title,
    urgency,
    note,
    status: "todo",
    order_index: Math.floor(Date.now() / 1000),
  });
  if (error) {
    await reply("שמירת המשימה נכשלה. נסה שוב מאוחר יותר.");
    return ok();
  }

  const urgHe =
    urgency === "urgent" ? "דחוף" : urgency === "high" ? "גבוהה" : urgency === "low" ? "נמוכה" : "בינונית";
  await reply(`✅ נוספה משימה (${urgHe}):\n${title}`);
  return ok();
});
