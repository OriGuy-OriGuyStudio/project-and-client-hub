import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { celebrate } from "@/lib/confetti";

type GiftNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
};

/**
 * Celebratory popup shown to a client/partner when the admin granted them gift
 * or compensation coins. Reads the unread gift/compensation notification, fires
 * confetti, and marks it read on acknowledge. Mount on the portal dashboards.
 */
export function GiftPopup() {
  const qc = useQueryClient();
  const [dismissed, setDismissed] = useState(false);

  const { data: gift } = useQuery({
    queryKey: ["gift-popup"],
    queryFn: async (): Promise<GiftNotification | null> => {
      const uid = (await supabase.auth.getUser()).data.user?.id;
      if (!uid) return null;
      const { data } = await supabase
        .from("notifications")
        .select("id, type, title, body")
        .eq("recipient_id", uid)
        .in("type", ["gift", "compensation"])
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as GiftNotification | null) ?? null;
    },
  });

  const open = !!gift && !dismissed;

  useEffect(() => {
    if (open) celebrate();
  }, [open]);

  async function ack() {
    if (gift) {
      await supabase.from("notifications").update({ is_read: true }).eq("id", gift.id);
      qc.invalidateQueries({ queryKey: ["gift-popup"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    }
    setDismissed(true);
  }

  if (!open || !gift) return null;

  return (
    <Dialog open onOpenChange={(o) => !o && ack()}>
      <DialogContent className="max-w-sm text-center">
        <div className="text-6xl" aria-hidden>
          {gift.type === "gift" ? "🎁" : "💛"}
        </div>
        <DialogHeader>
          <DialogTitle className="text-center font-heading text-2xl">{gift.title}</DialogTitle>
        </DialogHeader>
        {gift.body && <p className="text-sm leading-relaxed text-muted-foreground">{gift.body}</p>}
        <DialogFooter>
          <Button className="w-full" onClick={ack}>
            מגניב, תודה! 🙌
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
