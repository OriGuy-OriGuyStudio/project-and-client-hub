import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import gsap from "gsap";
import {
  Check,
  ChevronDown,
  CircleDashed,
  LayoutTemplate,
  Loader2,
  Map as MapIcon,
  Octagon,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/sheet";
import { supabase } from "@/lib/supabase";
import { toast, toastError } from "@/hooks/use-toast";
import { clampText } from "@/lib/sanitize";
import { logActivity } from "@/lib/activity";
import { stageStatusHe } from "@/lib/status";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";
import type {
  ProjectStage,
  StageStatus,
  StageTask,
  StageTemplate,
  UserRole,
} from "@/types/database";

const statusIcon: Record<StageStatus, typeof Check> = {
  not_started: CircleDashed,
  in_progress: Loader2,
  done: Check,
  blocked: Octagon,
};

const STAGE_STATUSES: StageStatus[] = ["not_started", "in_progress", "done", "blocked"];

export function ProgressTimeline({
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
  const fillRef = useRef<HTMLDivElement>(null);

  const { data: stages, isLoading } = useQuery({
    queryKey: ["stages", projectId],
    queryFn: async (): Promise<ProjectStage[]> => {
      const { data, error } = await supabase
        .from("project_stages")
        .select("*")
        .eq("project_id", projectId)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const stageIds = (stages ?? []).map((s) => s.id);

  // Sub-tasks across all of the project's stages, fetched in one go and grouped.
  const { data: subtasks } = useQuery({
    queryKey: ["stage-tasks", projectId, stageIds],
    enabled: stageIds.length > 0,
    queryFn: async (): Promise<StageTask[]> => {
      const { data, error } = await supabase
        .from("stage_tasks")
        .select("*")
        .in("stage_id", stageIds)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const tasksByStage = useMemo(() => {
    const m = new Map<string, StageTask[]>();
    for (const t of subtasks ?? []) {
      const arr = m.get(t.stage_id) ?? [];
      arr.push(t);
      m.set(t.stage_id, arr);
    }
    return m;
  }, [subtasks]);

  const total = stages?.length ?? 0;
  const doneCount = stages?.filter((s) => s.status === "done").length ?? 0;
  const pct = total > 1 ? (doneCount / (total - 1)) * 100 : doneCount > 0 ? 100 : 0;
  const nextOrder = (stages?.reduce((m, s) => Math.max(m, s.order_index), -1) ?? -1) + 1;

  // Collapsed phases (by stage id).
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  useEffect(() => {
    if (!fillRef.current) return;
    const target = Math.min(pct, 100);
    if (reduced) {
      gsap.set(fillRef.current, { width: `${target}%` });
      return;
    }
    const tween = gsap.to(fillRef.current, {
      width: `${target}%`,
      duration: 0.8,
      ease: "power2.out",
    });
    return () => {
      tween.kill();
    };
  }, [pct, reduced]);

  async function setStatus(stage: ProjectStage, status: StageStatus) {
    if (status === stage.status) return;
    const { error } = await supabase
      .from("project_stages")
      .update({ status })
      .eq("id", stage.id);
    if (error) {
      toastError("עדכון השלב נכשל.");
      return;
    }
    if (status === "done") {
      await logActivity({
        projectId,
        actorId,
        actionType: "stage_completed",
        description: `השלב "${stage.title}" הושלם`,
      });
    }
    qc.invalidateQueries({ queryKey: ["stages", projectId] });
  }

  async function deleteStage(stage: ProjectStage) {
    if (!window.confirm(`למחוק את השלב "${stage.title}"?`)) return;
    const { error } = await supabase
      .from("project_stages")
      .delete()
      .eq("id", stage.id);
    if (error) {
      toastError("מחיקת השלב נכשלה.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["stages", projectId] });
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <MapIcon className="size-5 text-brand-cyan-base" />
          <h2 className="font-heading text-lg font-semibold text-foreground">
            ציר התקדמות
          </h2>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-2">
            <TemplateDialog projectId={projectId} nextOrder={nextOrder} />
            <AddStageDialog projectId={projectId} nextOrder={nextOrder} />
          </div>
        )}
      </div>

      {isLoading ? (
        <Skeleton className="h-24 w-full rounded-xl" />
      ) : total === 0 ? (
        <EmptyState
          icon={MapIcon}
          title="אין עדיין שלבים"
          description={
            isAdmin
              ? 'הוסף שלב ידני עם "שלב חדש", או התחל מטמפלט מוכן.'
              : "הסטודיו יוסיף את שלבי הפרויקט כאן."
          }
        />
      ) : (
        <>
          {/* Connector track — fills right→left in RTL */}
          <div className="relative mb-6 h-1.5">
            <div className="absolute inset-0 rounded-full bg-brand-purple-light/40" />
            <div
              ref={fillRef}
              className="absolute inset-y-0 right-0 rounded-full bg-primary"
              style={{ width: 0 }}
            />
          </div>

          <ol className="space-y-3">
            {stages!.map((stage) => {
              const Icon = statusIcon[stage.status];
              const done = stage.status === "done";
              const stageTasks = tasksByStage.get(stage.id) ?? [];
              const tasksDone = stageTasks.filter((t) => t.is_done).length;
              const isCollapsed = collapsed.has(stage.id);
              return (
                <li
                  key={stage.id}
                  className="rounded-xl border border-border bg-background/30 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => toggleCollapse(stage.id)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-start"
                    >
                      <ChevronDown
                        className={cn(
                          "size-4 shrink-0 text-muted-foreground transition-transform",
                          isCollapsed && "-rotate-90"
                        )}
                      />
                      <span
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-full",
                          done
                            ? "bg-primary text-primary-foreground"
                            : "bg-brand-purple-base/30 text-muted-foreground"
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-4",
                            stage.status === "in_progress" && "animate-spin"
                          )}
                        />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate font-heading text-sm font-semibold text-foreground">
                          {stage.title}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {stage.assignee === "client" ? "באחריות הלקוח" : "באחריות הסטודיו"}
                          {stage.due_date &&
                            ` · יעד ${new Date(stage.due_date).toLocaleDateString("he-IL")}`}
                          {stageTasks.length > 0 &&
                            ` · ${tasksDone}/${stageTasks.length} משימות`}
                        </span>
                      </span>
                    </button>

                    <div className="flex shrink-0 items-center gap-2">
                      {isAdmin ? (
                        <>
                          <select
                            aria-label="סטטוס השלב"
                            value={stage.status}
                            onChange={(e) => setStatus(stage, e.target.value as StageStatus)}
                            className="h-8 rounded-lg border border-input bg-background/40 px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {STAGE_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {stageStatusHe[s]}
                              </option>
                            ))}
                          </select>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-destructive"
                            aria-label="מחיקת מקטע"
                            onClick={() => deleteStage(stage)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {stageStatusHe[stage.status]}
                        </span>
                      )}
                    </div>
                  </div>

                  {!isCollapsed && (
                    <StageTasks
                      projectId={projectId}
                      stageId={stage.id}
                      tasks={stageTasks}
                      isAdmin={isAdmin}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </>
      )}
    </Card>
  );
}

function StageTasks({
  projectId,
  stageId,
  tasks,
  isAdmin,
}: {
  projectId: string;
  stageId: string;
  tasks: StageTask[];
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: ["stage-tasks", projectId] });

  async function addTask() {
    const t = clampText(title.trim(), 200);
    if (!t) return;
    const nextOrder = tasks.reduce((m, x) => Math.max(m, x.order_index), -1) + 1;
    const { error } = await supabase
      .from("stage_tasks")
      .insert({ stage_id: stageId, title: t, order_index: nextOrder });
    if (error) return toastError("הוספת המשימה נכשלה.");
    setTitle("");
    setAdding(false);
    invalidate();
  }

  async function toggle(task: StageTask) {
    const { error } = await supabase
      .from("stage_tasks")
      .update({ is_done: !task.is_done })
      .eq("id", task.id);
    if (error) return toastError("עדכון המשימה נכשל.");
    invalidate();
  }

  async function remove(task: StageTask) {
    const { error } = await supabase.from("stage_tasks").delete().eq("id", task.id);
    if (error) return toastError("מחיקת המשימה נכשלה.");
    invalidate();
  }

  if (!isAdmin && tasks.length === 0) return null;

  return (
    <div className="mt-2 space-y-1.5 ps-11">
      {tasks.length > 0 && (
        <ul className="space-y-1">
          {tasks.map((t) => (
            <li key={t.id} className="group flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={t.is_done}
                disabled={!isAdmin}
                onChange={() => toggle(t)}
                className="size-4 accent-[var(--primary)]"
              />
              <span
                className={cn(
                  "flex-1",
                  t.is_done ? "text-muted-foreground line-through" : "text-foreground"
                )}
              >
                {t.title}
              </span>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => remove(t)}
                  aria-label="מחיקת משימה"
                  className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {isAdmin &&
        (adding ? (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={title}
              maxLength={200}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") addTask();
                if (e.key === "Escape") {
                  setAdding(false);
                  setTitle("");
                }
              }}
              placeholder="משימה חדשה…"
              className="h-8 text-sm"
            />
            <Button size="sm" onClick={addTask}>
              הוסף
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            <Plus className="size-3.5" /> הוסף משימה
          </button>
        ))}
    </div>
  );
}

function TemplateDialog({
  projectId,
  nextOrder,
}: {
  projectId: string;
  nextOrder: number;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["stage-templates"],
    enabled: open,
    queryFn: async (): Promise<StageTemplate[]> => {
      const { data, error } = await supabase
        .from("stage_templates")
        .select("*")
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function apply(tpl: StageTemplate) {
    setSaving(tpl.id);
    const rows = tpl.stages.map((s, i) => ({
      project_id: projectId,
      title: s.title,
      assignee: s.assignee,
      status: "not_started" as StageStatus,
      order_index: nextOrder + i,
    }));
    // Insert the phases and get their ids back (in order), then seed each
    // phase's sub-tasks from the template.
    const { data: inserted, error } = await supabase
      .from("project_stages")
      .insert(rows)
      .select("id");
    if (error || !inserted) {
      setSaving(null);
      return toastError("החלת הטמפלט נכשלה.");
    }

    const taskRows: { stage_id: string; title: string; order_index: number }[] = [];
    tpl.stages.forEach((s, i) => {
      const stageId = inserted[i]?.id;
      if (!stageId) return;
      (s.tasks ?? []).forEach((t, ti) => {
        const title = t.trim();
        if (title) taskRows.push({ stage_id: stageId, title, order_index: ti });
      });
    });
    if (taskRows.length) {
      await supabase.from("stage_tasks").insert(taskRows);
    }

    setSaving(null);
    toast({ title: `נוספו ${rows.length} מקטעים`, variant: "success" });
    qc.invalidateQueries({ queryKey: ["stages", projectId] });
    qc.invalidateQueries({ queryKey: ["stage-tasks", projectId] });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="ghost">
          <LayoutTemplate className="size-4" /> טמפלט
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>טמפלטי שלבים</DialogTitle>
          <DialogDescription>
            בחר תהליך עבודה מוכן. השלבים יתווספו לסוף הציר, ותוכל לערוך או למחוק
            כל שלב אחר כך.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {isLoading ? (
            <Skeleton className="h-20 w-full rounded-xl" />
          ) : !templates?.length ? (
            <p className="rounded-xl border border-border bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">
              אין תבניות. אפשר להוסיף ולערוך אותן בעמוד ההגדרות.
            </p>
          ) : (
            templates.map((tpl) => (
              <button
                key={tpl.id}
                type="button"
                disabled={saving !== null}
                onClick={() => apply(tpl)}
                className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-background/30 px-4 py-3 text-start transition-colors hover:border-primary/40 disabled:opacity-50"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{tpl.name}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {tpl.stages.length} שלבים · {tpl.stages.map((s) => s.title).join(" · ")}
                  </p>
                </div>
                {saving === tpl.id ? (
                  <Loader2 className="size-4 shrink-0 animate-spin text-primary" />
                ) : (
                  <Plus className="size-4 shrink-0 text-muted-foreground" />
                )}
              </button>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            סגירה
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddStageDialog({
  projectId,
  nextOrder,
}: {
  projectId: string;
  nextOrder: number;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    assignee: "admin" as UserRole,
    due_date: "",
  });

  async function save() {
    const title = clampText(form.title.trim(), 200);
    if (!title) return toastError("תן שם לשלב.");
    setSaving(true);
    const { error } = await supabase.from("project_stages").insert({
      project_id: projectId,
      title,
      assignee: form.assignee,
      due_date: form.due_date || null,
      status: "not_started",
      order_index: nextOrder,
    });
    setSaving(false);
    if (error) return toastError("הוספת השלב נכשלה.");
    toast({ title: "השלב נוסף", variant: "success" });
    qc.invalidateQueries({ queryKey: ["stages", projectId] });
    setForm({ title: "", assignee: "admin", due_date: "" });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary">
          <Plus className="size-4" /> שלב חדש
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>שלב חדש</DialogTitle>
          <DialogDescription>הוסף שלב לציר ההתקדמות של הפרויקט.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="stage-title">שם השלב</Label>
            <Input
              id="stage-title"
              value={form.title}
              maxLength={200}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="לדוגמה: אפיון ואיסוף חומרים"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="stage-assignee">באחריות</Label>
              <select
                id="stage-assignee"
                value={form.assignee}
                onChange={(e) =>
                  setForm((f) => ({ ...f, assignee: e.target.value as UserRole }))
                }
                className="flex h-10 w-full rounded-xl border border-input bg-background/40 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="admin">הסטודיו</option>
                <option value="client">הלקוח</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stage-due">תאריך יעד</Label>
              <Input
                id="stage-due"
                type="date"
                value={form.due_date}
                onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={saving}>
            {saving ? "מוסיף…" : "הוספה"}
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
