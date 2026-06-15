import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CheckCircle2, MessageSquareWarning, Plus, Stamp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { supabase } from "@/lib/supabase";
import { toast, toastError } from "@/hooks/use-toast";
import { logActivity } from "@/lib/activity";
import { celebrate } from "@/lib/confetti";
import { approvalStatusHe } from "@/lib/status";
import { clampText } from "@/lib/sanitize";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { useNotifyClient } from "@/components/project/NotifyClient";
import type { Approval } from "@/types/database";

export function ApprovalsSection({
  projectId,
  isAdmin,
  actorId,
}: {
  projectId: string;
  isAdmin: boolean;
  actorId: string | null;
}) {
  const qc = useQueryClient();
  const reduced = usePrefersReducedMotion();
  const { requestNotify } = useNotifyClient();
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");

  const { data: approvals, isLoading } = useQuery({
    queryKey: ["approvals", projectId],
    queryFn: async (): Promise<Approval[]> => {
      const { data, error } = await supabase
        .from("approvals")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["approvals", projectId] });

  async function createApproval() {
    const title = clampText(newTitle.trim(), 200);
    if (!title) return;
    const { error } = await supabase
      .from("approvals")
      .insert({ project_id: projectId, title });
    if (error) return toastError("יצירת הבקשה נכשלה.");
    await logActivity({
      projectId,
      actorId,
      actionType: "approval_requested",
      description: `נשלחה לאישור: "${title}"`,
    });
    setNewTitle("");
    setAdding(false);
    refresh();
    requestNotify({
      type: "approval",
      title: "בקשת אישור חדשה ממתינה לך",
      body: title,
    });
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Stamp className="size-5 text-brand-cyan-base" />
          <h2 className="font-heading text-lg font-semibold text-foreground">
            אישור עבודה
          </h2>
        </div>
        {isAdmin && (
          <Button size="sm" variant="ghost" onClick={() => setAdding((v) => !v)}>
            <Plus className="size-4" /> בקשת אישור
          </Button>
        )}
      </div>

      {adding && (
        <div className="mb-4 flex items-center gap-2">
          <Input
            placeholder="מה מוכן לאישור? (לדוגמה: עיצוב עמוד הבית)"
            maxLength={200}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
          />
          <Button size="sm" onClick={createApproval}>
            שליחה
          </Button>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-20 w-full rounded-xl" />
      ) : !approvals?.length ? (
        <EmptyState
          icon={CheckCircle2}
          title="אין בקשות אישור"
          description="כשתוצר יהיה מוכן לבדיקתך, הוא יופיע כאן."
        />
      ) : (
        <div className="space-y-3">
          {approvals.map((a) => (
            <motion.div
              key={a.id}
              animate={
                a.status === "pending" && !reduced
                  ? { scale: [1, 1.015, 1] }
                  : undefined
              }
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <ApprovalRow
                approval={a}
                isAdmin={isAdmin}
                projectId={projectId}
                actorId={actorId}
                onChange={refresh}
              />
            </motion.div>
          ))}
        </div>
      )}
    </Card>
  );
}

function ApprovalRow({
  approval,
  isAdmin,
  projectId,
  actorId,
  onChange,
}: {
  approval: Approval;
  isAdmin: boolean;
  projectId: string;
  actorId: string | null;
  onChange: () => void;
}) {
  const [noting, setNoting] = useState(false);
  const [notes, setNotes] = useState("");

  async function decide(status: "approved" | "needs_changes", clientNotes?: string) {
    const { error } = await supabase
      .from("approvals")
      .update({ status, client_notes: clientNotes ?? null })
      .eq("id", approval.id);
    if (error) return toastError("עדכון האישור נכשל.");
    await logActivity({
      projectId,
      actorId,
      actionType: status === "approved" ? "approval_granted" : "approval_changes",
      description:
        status === "approved"
          ? `אושר: "${approval.title}"`
          : `התקבלו הערות על: "${approval.title}"`,
    });
    if (status === "approved") {
      celebrate();
      toast({ title: "אושר בהצלחה", variant: "success" });
    }
    setNoting(false);
    onChange();
  }

  const variant =
    approval.status === "approved"
      ? "success"
      : approval.status === "needs_changes"
        ? "warning"
        : "default";

  return (
    <div className="rounded-xl border border-border bg-background/30 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium text-foreground">{approval.title}</p>
          {approval.description && (
            <p className="text-sm text-muted-foreground">{approval.description}</p>
          )}
        </div>
        <Badge variant={variant}>{approvalStatusHe[approval.status]}</Badge>
      </div>

      {approval.client_notes && (
        <p className="mt-2 rounded-lg bg-card px-3 py-2 text-sm text-muted-foreground">
          {approval.client_notes}
        </p>
      )}

      {/* Client decision controls (admins view status only) */}
      {!isAdmin && approval.status === "pending" && (
        <div className="mt-3">
          {noting ? (
            <div className="space-y-2">
              <Textarea
                placeholder="מה צריך לשנות?"
                maxLength={2000}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setNoting(false)}>
                  ביטול
                </Button>
                <Button
                  size="sm"
                  onClick={() => decide("needs_changes", clampText(notes.trim(), 2000))}
                >
                  שליחת הערות
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button size="sm" onClick={() => decide("approved")}>
                <CheckCircle2 className="size-4" /> אישרתי
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setNoting(true)}>
                <MessageSquareWarning className="size-4" /> יש לי הערות
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
