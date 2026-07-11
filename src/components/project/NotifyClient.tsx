import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { BellRing, Mail, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/lib/supabase";
import { toast, toastError } from "@/hooks/use-toast";

/** A request to nudge the client about something the studio just did. */
export type NotifyPayload = { type: string; title: string; body?: string };

type NotifyCtx = { requestNotify: (p: NotifyPayload) => void };

// No-op default so sections that call the hook in the client view (no provider)
// don't break - only the admin tree wraps children in a real provider.
const Ctx = createContext<NotifyCtx>({ requestNotify: () => {} });

export function useNotifyClient() {
  return useContext(Ctx);
}

type ClientContact = {
  projectId: string;
  projectTitle: string;
  clientId: string;
  clientName: string | null;
  clientPhone: string | null;
  clientEmail: string | null;
};

export function NotifyClientProvider({
  contact,
  children,
}: {
  contact: ClientContact;
  children: ReactNode;
}) {
  const [payload, setPayload] = useState<NotifyPayload | null>(null);
  const requestNotify = useCallback((p: NotifyPayload) => setPayload(p), []);

  return (
    <Ctx.Provider value={{ requestNotify }}>
      {children}
      <NotifyDialog
        payload={payload}
        contact={contact}
        onClose={() => setPayload(null)}
      />
    </Ctx.Provider>
  );
}

/** Manual entry point - "let the client know there's an update". Admin only. */
export function NotifyClientButton({ className }: { className?: string }) {
  const { requestNotify } = useNotifyClient();
  return (
    <Button
      variant="secondary"
      size="sm"
      className={className}
      onClick={() =>
        requestNotify({ type: "update", title: "יש עדכון בפרויקט שלך" })
      }
    >
      <BellRing className="size-4" /> הודע ללקוח
    </Button>
  );
}

function waLink(phone: string, text: string) {
  const digits = phone.replace(/\D/g, "").replace(/^0/, "972");
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

function gmailLink(email: string, subject: string, body: string) {
  return (
    "https://mail.google.com/mail/?view=cm&fs=1" +
    `&to=${encodeURIComponent(email)}` +
    `&su=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`
  );
}

function NotifyDialog({
  payload,
  contact,
  onClose,
}: {
  payload: NotifyPayload | null;
  contact: ClientContact;
  onClose: () => void;
}) {
  const portalUrl = `${window.location.origin}/projects/${contact.projectId}`;
  // Channels: where the message goes. Any combination ("גם וגם") is allowed.
  const [chInApp, setChInApp] = useState(true);
  const [chEmail, setChEmail] = useState(false);
  const [chWhats, setChWhats] = useState(false);
  // Custom-note toggle: off = a generic "there's an update" nudge (the old
  // behaviour); on = the admin's own note is what gets delivered everywhere,
  // including into the in-app bell (not just WhatsApp / email).
  const [custom, setCustom] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const defaultMessage = (() => {
    if (!payload) return "";
    const greeting = contact.clientName ? `היי ${contact.clientName}, ` : "היי, ";
    const lead = payload.body ? `${payload.title} - ${payload.body}` : payload.title;
    return `${greeting}${lead}.\nאפשר לראות את הפרטים בפורטל: ${portalUrl}`;
  })();

  // Re-seed each time a new request opens the dialog.
  useEffect(() => {
    if (!payload) return;
    setChInApp(true);
    setChEmail(false);
    setChWhats(false);
    setCustom(false);
    setNote("");
  }, [payload]);

  // The free-text body sent over WhatsApp / email.
  const messageText = custom ? note.trim() : defaultMessage;

  async function send() {
    if (!payload) return;
    if (!chInApp && !chEmail && !chWhats) {
      return toastError("בחר לפחות ערוץ אחד לשליחה.");
    }
    if (custom && !note.trim()) {
      return toastError("כתוב את ההערה המותאמת אישית, או כבה את ההערה.");
    }

    setBusy(true);
    // 1) In-app bell. Fans out to every manager of the project's organization
    //    (not just the single client). With a custom note, the note itself
    //    becomes the body the client reads in the bell.
    if (chInApp) {
      const { error } = await supabase.rpc("notify_org_managers", {
        p_project: contact.projectId,
        p_type: payload.type,
        p_title: custom ? "הודעה מהסטודיו" : payload.title,
        p_body: custom ? note.trim() : payload.body ?? null,
        p_link: `/projects/${contact.projectId}`,
      });
      if (error) {
        setBusy(false);
        return toastError("יצירת ההתראה בממשק נכשלה.");
      }
    }
    setBusy(false);

    // 2) External channels open in a new tab (admin-driven, may need a click).
    const subject = custom ? "הודעה מהסטודיו" : payload.title;
    if (chEmail && contact.clientEmail) {
      window.open(gmailLink(contact.clientEmail, subject, messageText), "_blank", "noopener");
    }
    if (chWhats && contact.clientPhone) {
      window.open(waLink(contact.clientPhone, messageText), "_blank", "noopener");
    }

    toast({ title: "ההודעה נשלחה ללקוח", variant: "success" });
    onClose();
  }

  return (
    <Dialog open={!!payload} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>הודעה ללקוח</DialogTitle>
          <DialogDescription>
            {payload?.title}
            {contact.clientName ? ` · ${contact.clientName}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <span className="text-sm text-muted-foreground">לאן לשלוח?</span>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={chInApp}
                  onChange={(e) => setChInApp(e.target.checked)}
                  className="size-4 accent-[var(--primary)]"
                />
                <BellRing className="size-4 text-muted-foreground" /> ממשק (פעמון)
              </label>
              <label
                className="flex cursor-pointer items-center gap-2 text-sm text-foreground aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                aria-disabled={!contact.clientEmail}
                title={contact.clientEmail ? undefined : "אין מייל ללקוח"}
              >
                <input
                  type="checkbox"
                  checked={chEmail}
                  disabled={!contact.clientEmail}
                  onChange={(e) => setChEmail(e.target.checked)}
                  className="size-4 accent-[var(--primary)]"
                />
                <Mail className="size-4 text-muted-foreground" /> מייל
              </label>
              <label
                className="flex cursor-pointer items-center gap-2 text-sm text-foreground aria-disabled:cursor-not-allowed aria-disabled:opacity-50"
                aria-disabled={!contact.clientPhone}
                title={contact.clientPhone ? undefined : "אין טלפון ללקוח"}
              >
                <input
                  type="checkbox"
                  checked={chWhats}
                  disabled={!contact.clientPhone}
                  onChange={(e) => setChWhats(e.target.checked)}
                  className="size-4 accent-[var(--primary)]"
                />
                <MessageCircle className="size-4 text-muted-foreground" /> וואטסאפ
              </label>
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={custom}
              onChange={(e) => setCustom(e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            הערה מותאמת אישית
          </label>

          {custom ? (
            <div className="space-y-1.5">
              <span className="text-sm text-muted-foreground">
                ההערה שתישלח לערוצים שבחרת (גם לפעמון בממשק):
              </span>
              <Textarea
                value={note}
                maxLength={1000}
                rows={5}
                placeholder="כתוב כאן הודעה אישית ללקוח…"
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          ) : (
            <p className="rounded-lg bg-muted/40 p-3 text-sm text-muted-foreground">
              תישלח הודעת עדכון כללית. להוספת טקסט משלך, הפעל "הערה מותאמת אישית".
            </p>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
            ביטול
          </Button>
          <Button type="button" onClick={send} disabled={busy}>
            <Send className="size-4" /> שליחה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
