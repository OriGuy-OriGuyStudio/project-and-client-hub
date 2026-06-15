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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectMenu } from "@/components/ui/select-menu";
import { supabase } from "@/lib/supabase";
import { sendGiftNotice } from "@/lib/invite";
import { toast, toastError } from "@/hooks/use-toast";

/**
 * Admin grants gift / compensation coins to a client or partner. Credits the
 * right ledger (server-side grant_coins RPC), then emails the recipient. The
 * portal pops a celebratory message from the notification the RPC creates.
 */
export function GrantCoinsDialog({
  open,
  onClose,
  userId,
  recipientName,
  /** which react-query keys to refresh after granting */
  invalidateKeys = [],
}: {
  open: boolean;
  onClose: () => void;
  userId: string;
  recipientName?: string;
  invalidateKeys?: unknown[][];
}) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState("");
  const [kind, setKind] = useState<"gift" | "compensation">("gift");
  const [reason, setReason] = useState("");

  function reset() {
    setAmount("");
    setKind("gift");
    setReason("");
  }

  async function save() {
    const n = Number(amount);
    if (Number.isNaN(n) || n <= 0) return toastError("צריך להזין כמות מטבעות חיובית.");

    setSaving(true);
    const { error } = await supabase.rpc("grant_coins", {
      p_user: userId,
      p_amount: Math.round(n),
      p_kind: kind,
      p_reason: reason.trim() || null,
    });
    if (error) {
      setSaving(false);
      return toastError(error.message || "מתן המטבעות נכשל.");
    }

    // Best-effort email; the in-app popup works regardless.
    const mail = await sendGiftNotice(userId, kind, Math.round(n), reason.trim());
    setSaving(false);

    toast({
      title: kind === "gift" ? "המתנה נשלחה 🎁" : "הפיצוי נשלח 💛",
      description: mail.ok ? "נשלח גם מייל ליידוע." : "המטבעות ניתנו (שליחת המייל נכשלה).",
      variant: "success",
    });
    invalidateKeys.forEach((key) => qc.invalidateQueries({ queryKey: key }));
    reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>מתן מטבעות{recipientName ? ` ל${recipientName}` : ""}</DialogTitle>
          <DialogDescription>
            מתנה או פיצוי. המטבעות נזקפות מיד, ויוקפץ למקבל חיווי שמח בממשק + מייל.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="gc-amount">כמות מטבעות</Label>
              <Input
                id="gc-amount"
                dir="ltr"
                type="number"
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="50"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="gc-kind">סוג</Label>
              <SelectMenu
                id="gc-kind"
                variant="field"
                ariaLabel="סוג"
                value={kind}
                onChange={(v) => setKind(v as "gift" | "compensation")}
                options={[
                  { value: "gift", label: "🎁 מתנה" },
                  { value: "compensation", label: "💛 פיצוי" },
                ]}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gc-reason">סיבה (אופציונלי, יוצג למקבל)</Label>
            <Textarea
              id="gc-reason"
              maxLength={300}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={kind === "gift" ? "למשל: תודה על שיתוף הפעולה" : "למשל: על העיכוב באספקה"}
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={saving}>
            {saving ? "שולח…" : "מתן מטבעות"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
