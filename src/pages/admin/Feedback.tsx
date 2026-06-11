import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MessageSquareHeart } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { supabase } from "@/lib/supabase";
import { toast, toastError } from "@/hooks/use-toast";
import { clampText } from "@/lib/sanitize";
import { useAllFeedback, feedbackStatusHe, type AdminFeedback } from "@/hooks/useClientFeedback";
import type { ClientFeedback } from "@/types/database";

const STATUSES: ClientFeedback["status"][] = ["open", "in_progress", "resolved"];

export default function Feedback() {
  const { data, isLoading } = useAllFeedback();

  return (
    <div>
      <PageHeader title="הערות לקוחות" subtitle="הערות לשיפור הממשק, ומענה ישיר ללקוח." />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-2xl" />
          ))}
        </div>
      ) : !data?.length ? (
        <EmptyState icon={MessageSquareHeart} title="אין עדיין הערות" />
      ) : (
        <div className="space-y-3">
          {data.map((f) => (
            <FeedbackRow key={f.id} item={f} />
          ))}
        </div>
      )}
    </div>
  );
}

function FeedbackRow({ item }: { item: AdminFeedback }) {
  const qc = useQueryClient();
  const [reply, setReply] = useState(item.admin_reply ?? "");
  const [status, setStatus] = useState<ClientFeedback["status"]>(item.status);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("client_feedback")
      .update({ admin_reply: clampText(reply.trim(), 2000) || null, status })
      .eq("id", item.id);
    setSaving(false);
    if (error) return toastError("העדכון נכשל.");
    toast({ title: "נשלח ללקוח", variant: "success" });
    qc.invalidateQueries({ queryKey: ["admin-feedback"] });
  }

  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm text-foreground">{item.message}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {item.client_name} · {new Date(item.created_at).toLocaleDateString("he-IL")}
          </p>
        </div>
        <Badge
          variant={
            item.status === "resolved" ? "success" : item.status === "in_progress" ? "warning" : "secondary"
          }
        >
          {feedbackStatusHe[item.status]}
        </Badge>
      </div>

      <div className="flex items-start gap-2">
        <Textarea
          value={reply}
          maxLength={2000}
          onChange={(e) => setReply(e.target.value)}
          placeholder="תשובה / סטטוס ללקוח…"
          className="min-h-16"
        />
        <div className="flex flex-col gap-2">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as ClientFeedback["status"])}
            className="h-9 rounded-lg border border-input bg-background/40 px-2 text-sm text-foreground"
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {feedbackStatusHe[s]}
              </option>
            ))}
          </select>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "שומר…" : "שליחה"}
          </Button>
        </div>
      </div>
    </Card>
  );
}
