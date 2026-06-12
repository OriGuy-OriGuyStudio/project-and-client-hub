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
  const [message, setMessage] = useState("");
  const [showInApp, setShowInApp] = useState(true);
  const [inserted, setInserted] = useState(false);
  const [busy, setBusy] = useState(false);

  // Re-seed the editable message each time a new request opens the dialog.
  useEffect(() => {
    if (!payload) return;
    const greeting = contact.clientName ? `היי ${contact.clientName}, ` : "היי, ";
    const lead = payload.body ? `${payload.title} - ${payload.body}` : payload.title;
    setMessage(`${greeting}${lead}.\nאפשר לראות את הפרטים בפורטל: ${portalUrl}`);
    setShowInApp(true);
    setInserted(false);
  }, [payload, contact.clientName, portalUrl]);

  // Create the in-app notification once (idempotent across the channel buttons).
  async function ensureInApp() {
    if (!payload || inserted || !showInApp) return;
    const { error } = await supabase.from("notifications").insert({
      audience: "client",
      recipient_id: contact.clientId,
      type: payload.type,
      title: payload.title,
      body: payload.body ?? null,
      link: `/projects/${contact.projectId}`,
      project_id: contact.projectId,
    });
    if (error) {
      toastError("יצירת ההתראה בממשק נכשלה.");
      return;
    }
    setInserted(true);
  }

  async function sendWhatsApp() {
    if (!contact.clientPhone) return;
    setBusy(true);
    await ensureInApp();
    setBusy(false);
    window.open(waLink(contact.clientPhone, message), "_blank", "noopener");
    onClose();
  }

  async function sendEmail() {
    if (!contact.clientEmail) return;
    setBusy(true);
    await ensureInApp();
    setBusy(false);
    window.open(
      gmailLink(contact.clientEmail, payload?.title ?? "עדכון מהסטודיו", message),
      "_blank",
      "noopener"
    );
    onClose();
  }

  async function saveInAppOnly() {
    if (!showInApp) return onClose();
    setBusy(true);
    await ensureInApp();
    setBusy(false);
    toast({ title: "התראה נשלחה ללקוח", variant: "success" });
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
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={showInApp}
              onChange={(e) => setShowInApp(e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            הצג התראה בממשק הלקוח (פעמון)
          </label>

          <div className="space-y-1.5">
            <span className="text-sm text-muted-foreground">
              ההודעה שתישלח בוואטסאפ / מייל:
            </span>
            <Textarea
              value={message}
              maxLength={1000}
              rows={5}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={sendWhatsApp}
              disabled={busy || !contact.clientPhone}
              title={contact.clientPhone ? undefined : "אין מספר טלפון ללקוח"}
            >
              <MessageCircle className="size-4" /> וואטסאפ
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={sendEmail}
              disabled={busy || !contact.clientEmail}
            >
              <Mail className="size-4" /> מייל
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={saveInAppOnly}
              disabled={busy}
            >
              <Send className="size-4" /> {showInApp ? "התראה בממשק בלבד" : "סגירה"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
