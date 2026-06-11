import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { supabase } from "@/lib/supabase";
import { toastError } from "@/hooks/use-toast";
import { logActivity } from "@/lib/activity";
import { clampText } from "@/lib/sanitize";
import { cn } from "@/lib/utils";
import { useNotifyClient } from "@/components/project/NotifyClient";
import type { ChecklistItem } from "@/types/database";

export function ChecklistSection({
  projectId,
  isAdmin,
  actorId,
}: {
  projectId: string;
  isAdmin: boolean;
  actorId: string | null;
}) {
  const qc = useQueryClient();
  const { requestNotify } = useNotifyClient();
  const [label, setLabel] = useState("");

  const { data: items, isLoading } = useQuery({
    queryKey: ["checklist", projectId],
    queryFn: async (): Promise<ChecklistItem[]> => {
      const { data, error } = await supabase
        .from("checklist_items")
        .select("*")
        .eq("project_id", projectId)
        .order("sent_at", { ascending: true, nullsFirst: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["checklist", projectId] });
  const sent = items?.filter((i) => i.is_sent).length ?? 0;

  async function addItem() {
    const text = clampText(label.trim(), 160);
    if (!text) return;
    const { error } = await supabase
      .from("checklist_items")
      .insert({ project_id: projectId, label: text });
    if (error) return toastError("הוספת הפריט נכשלה.");
    setLabel("");
    refresh();
    requestNotify({
      type: "checklist",
      title: "הסטודיו ביקש חומרים",
      body: text,
    });
  }

  async function toggle(item: ChecklistItem) {
    const next = !item.is_sent;
    const { error } = await supabase
      .from("checklist_items")
      .update({ is_sent: next, sent_at: next ? new Date().toISOString() : null })
      .eq("id", item.id);
    if (error) return toastError("העדכון נכשל.");
    if (next)
      await logActivity({
        projectId,
        actorId,
        actionType: "checklist_sent",
        description: `סומן כנשלח: "${item.label}"`,
      });
    refresh();
  }

  async function remove(item: ChecklistItem) {
    const { error } = await supabase.from("checklist_items").delete().eq("id", item.id);
    if (error) return toastError("המחיקה נכשלה.");
    refresh();
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ClipboardList className="size-5 text-brand-cyan-base" />
          <h2 className="font-heading text-lg font-semibold text-foreground">
            חומרים דרושים
          </h2>
        </div>
        {items && items.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {sent}/{items.length} נשלחו
          </span>
        )}
      </div>

      {isAdmin && (
        <div className="mb-4 flex items-center gap-2">
          <Input
            placeholder="הוסף חומר נדרש (לוגו, תמונות, טקסטים…)"
            maxLength={160}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addItem()}
          />
          <Button size="sm" onClick={addItem}>
            <Plus className="size-4" />
          </Button>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-20 w-full rounded-xl" />
      ) : !items?.length ? (
        <EmptyState
          icon={ClipboardList}
          title="אין עדיין חומרים ברשימה"
          description={isAdmin ? "הוסף את החומרים שתצטרך מהלקוח." : "הסטודיו יוסיף כאן את החומרים הנדרשים."}
        />
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-background/30 px-4 py-2.5"
            >
              <label className="flex flex-1 cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={item.is_sent}
                  onChange={() => toggle(item)}
                  className="size-4 accent-[var(--primary)]"
                />
                <span
                  className={cn(
                    "text-sm",
                    item.is_sent ? "text-muted-foreground line-through" : "text-foreground"
                  )}
                >
                  {item.label}
                </span>
              </label>
              {isAdmin && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive"
                  aria-label="מחיקה"
                  onClick={() => remove(item)}
                >
                  <Trash2 className="size-4" />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
