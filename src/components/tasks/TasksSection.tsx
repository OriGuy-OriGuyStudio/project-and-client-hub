import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ListChecks, Lock, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { supabase } from "@/lib/supabase";
import { toastError } from "@/hooks/use-toast";
import { clampText } from "@/lib/sanitize";
import type { Task, TaskStatus } from "@/types/database";

const COLUMNS: { key: TaskStatus; label: string }[] = [
  { key: "open", label: "פתוח" },
  { key: "in_progress", label: "בתהליך" },
  { key: "done", label: "הושלם" },
];

export function TasksSection({
  projectId,
  isAdmin,
  clientId,
  adminId,
}: {
  projectId: string;
  isAdmin: boolean;
  clientId: string;
  adminId: string | null;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    assignee: "none" as "none" | "studio" | "client",
    is_private: false,
  });

  const { data: tasks, isLoading } = useQuery({
    queryKey: ["tasks", projectId],
    queryFn: async (): Promise<Task[]> => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["tasks", projectId] });

  async function addTask() {
    const title = clampText(form.title.trim(), 200);
    if (!title) return;
    const assignee_id =
      form.assignee === "client" ? clientId : form.assignee === "studio" ? adminId : null;
    const { error } = await supabase.from("tasks").insert({
      project_id: projectId,
      title,
      assignee_id,
      is_private: form.is_private,
    });
    if (error) return toastError("הוספת המשימה נכשלה.");
    setForm({ title: "", assignee: "none", is_private: false });
    setOpen(false);
    refresh();
  }

  async function setStatus(task: Task, status: TaskStatus) {
    const { error } = await supabase.from("tasks").update({ status }).eq("id", task.id);
    if (error) return toastError("העדכון נכשל.");
    refresh();
  }

  async function remove(task: Task) {
    const { error } = await supabase.from("tasks").delete().eq("id", task.id);
    if (error) return toastError("המחיקה נכשלה.");
    refresh();
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ListChecks className="size-5 text-brand-cyan-base" />
          <h2 className="font-heading text-lg font-semibold text-foreground">משימות</h2>
        </div>
        {isAdmin && (
          <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
            <Plus className="size-4" /> משימה
          </Button>
        )}
      </div>

      {isAdmin && open && (
        <div className="mb-4 space-y-2 rounded-xl border border-border bg-background/30 p-3">
          <Input
            placeholder="כותרת המשימה"
            maxLength={200}
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={form.assignee}
              onChange={(e) =>
                setForm((f) => ({ ...f, assignee: e.target.value as typeof f.assignee }))
              }
              className="h-9 rounded-lg border border-input bg-field px-3 text-sm text-foreground"
            >
              <option value="none">ללא אחראי</option>
              <option value="studio">הסטודיו</option>
              <option value="client">הלקוח</option>
            </select>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={form.is_private}
                onChange={(e) => setForm((f) => ({ ...f, is_private: e.target.checked }))}
                className="size-4 accent-[var(--primary)]"
              />
              פרטי (מוסתר מהלקוח)
            </label>
            <Button size="sm" className="ms-auto" onClick={addTask}>
              הוספה
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-28 w-full rounded-xl" />
      ) : !tasks?.length ? (
        <EmptyState icon={ListChecks} title="אין עדיין משימות" />
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {COLUMNS.map((col) => {
            const colTasks = tasks.filter((t) => t.status === col.key);
            return (
              <div key={col.key} className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {col.label} ({colTasks.length})
                </p>
                {colTasks.map((t) => (
                  <div
                    key={t.id}
                    className="rounded-xl border border-border bg-background/30 p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-foreground">{t.title}</p>
                      {t.is_private && (
                        <Badge variant="secondary" className="shrink-0">
                          <Lock className="size-3" />
                        </Badge>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-1">
                      <select
                        value={t.status}
                        onChange={(e) => setStatus(t, e.target.value as TaskStatus)}
                        className="h-7 flex-1 rounded-lg border border-input bg-field px-2 text-xs text-foreground"
                      >
                        {COLUMNS.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.label}
                          </option>
                        ))}
                      </select>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7 text-destructive"
                          aria-label="מחיקה"
                          onClick={() => remove(t)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
