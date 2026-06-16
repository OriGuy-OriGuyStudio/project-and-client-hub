import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast, toastError } from "@/hooks/use-toast";
import { clampText } from "@/lib/sanitize";

/**
 * In-app "leave a note" form, usable by any signed-in client or partner. Writes
 * to client_feedback (RLS: client_id = auth.uid()); the notify_feedback trigger
 * alerts the admin. Replaces the old WhatsApp hand-off for partners.
 */
export function FeedbackDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    const msg = clampText(message.trim(), 2000);
    if (!msg) return toastError("צריך לכתוב הערה.");
    if (!profile?.id) return toastError("צריך להיות מחובר.");
    setSaving(true);
    const { error } = await supabase
      .from("client_feedback")
      .insert({ client_id: profile.id, message: msg });
    setSaving(false);
    if (error) return toastError("שליחת ההערה נכשלה. נסה שוב.");
    toast({ title: "ההערה נשלחה לאורי, תודה!", variant: "success" });
    setMessage("");
    qc.invalidateQueries({ queryKey: ["my-feedback"] });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>כתיבת הערה</DialogTitle>
          <DialogDescription>מצאת באג, חסר משהו, או יש לך רעיון לשיפור? ספר לי.</DialogDescription>
        </DialogHeader>
        <Textarea
          value={message}
          maxLength={2000}
          rows={5}
          placeholder="כתוב כאן…"
          onChange={(e) => setMessage(e.target.value)}
        />
        <DialogFooter>
          <Button onClick={submit} disabled={saving}>
            {saving ? "שולח…" : "שליחה"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
