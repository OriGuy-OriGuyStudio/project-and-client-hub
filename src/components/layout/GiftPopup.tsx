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

const EMOJI: Record<string, string> = {
  gift: "🎁",
  compensation: "💛",
  redemption_fulfilled: "🎉",
};

/**
 * Celebratory popup(s) shown to a client/partner for unread gift / compensation
 * grants and approved redemptions. Queues multiple (one after another), waits
 * for the post-login loader to clear before showing, fires confetti per popup,
 * and records the acknowledgement (acknowledge_coin_grant) for the audit trail.
 */
export function GiftPopup() {
  const qc = useQueryClient();
  const [ready, setReady] = useState(false);
  const [queue, setQueue] = useState<GiftNotification[] | null>(null);

  const { data } = useQuery({
    queryKey: ["gift-popup"],
    queryFn: async (): Promise<GiftNotification[]> => {
      const uid = (await supabase.auth.getUser()).data.user?.id;
      if (!uid) return [];
      const { data } = await supabase
        .from("notifications")
        .select("id, type, title, body")
        .eq("recipient_id", uid)
        .in("type", ["gift", "compensation", "redemption_fulfilled"])
        .eq("is_read", false)
        .order("created_at", { ascending: true });
      return (data as GiftNotification[] | null) ?? [];
    },
  });

  // Let the post-login loader finish before popping anything.
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 2200);
    return () => clearTimeout(t);
  }, []);

  // Seed the queue once (so a re-fetch can't re-open dismissed ones mid-session).
  useEffect(() => {
    if (ready && queue === null && data) setQueue(data);
  }, [ready, data, queue]);

  const current = queue && queue.length ? queue[0] : null;

  useEffect(() => {
    if (current) celebrate();
  }, [current?.id]);

  async function ack() {
    if (!current) return;
    if (current.type === "gift" || current.type === "compensation") {
      await supabase.rpc("acknowledge_coin_grant", { p_notification_id: current.id });
    } else {
      await supabase.from("notifications").update({ is_read: true }).eq("id", current.id);
    }
    qc.invalidateQueries({ queryKey: ["notifications"] });
    setQueue((q) => (q ? q.slice(1) : q));
  }

  if (!current) return null;

  return (
    <Dialog open onOpenChange={(o) => !o && ack()}>
      <DialogContent className="max-w-sm text-center">
        <div className="text-6xl" aria-hidden>
          {EMOJI[current.type] ?? "🎉"}
        </div>
        <DialogHeader>
          <DialogTitle className="text-center font-heading text-2xl">{current.title}</DialogTitle>
        </DialogHeader>
        {current.body && (
          <p className="text-sm leading-relaxed text-muted-foreground">{current.body}</p>
        )}
        <DialogFooter>
          <Button className="w-full" onClick={ack}>
            מגניב, תודה! 🙌
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
