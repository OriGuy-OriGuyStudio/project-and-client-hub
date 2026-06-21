import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowDownUp,
  CalendarClock,
  Check,
  ChevronDown,
  Download,
  FolderKanban,
  GripVertical,
  Handshake,
  ListChecks,
  Megaphone,
  Pencil,
  Plus,
  StickyNote,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  defaultAnimateLayoutChanges,
  type AnimateLayoutChanges,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

// Drops are animated by dnd-kit (smooth, no jump). Framer Motion's `layout`
// animates the OTHER reorders — a completed task sliding to the bottom — but is
// switched off mid-drag so the two never fight over the same row.
const animateLayoutChanges: AnimateLayoutChanges = (args) =>
  defaultAnimateLayoutChanges({ ...args, wasDragging: true });
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectMenu } from "@/components/ui/select-menu";
import { CenteredLoader } from "@/components/ui/brand-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { supabase } from "@/lib/supabase";
import { toast, toastError } from "@/hooks/use-toast";
import { clampText } from "@/lib/sanitize";
import { cn } from "@/lib/utils";
import { useTaskBoardGroups, useTaskBoardTasks } from "@/hooks/useTaskBoard";
import { useProjects } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { usePartners } from "@/hooks/usePartners";
import type {
  AdminTask,
  AdminTaskGroup,
  AdminTaskStatus,
  TaskUrgency,
} from "@/types/database";

/* --------------------------- display dictionaries --------------------------- */

const URGENCY: Record<
  TaskUrgency,
  { label: string; variant: "secondary" | "cyan" | "warning" | "destructive" }
> = {
  low: { label: "נמוכה", variant: "secondary" },
  medium: { label: "בינונית", variant: "cyan" },
  high: { label: "גבוהה", variant: "warning" },
  urgent: { label: "דחוף", variant: "destructive" },
};
const URGENCY_OPTIONS = (Object.keys(URGENCY) as TaskUrgency[]).map((u) => ({
  value: u,
  label: URGENCY[u].label,
}));

const STATUS: Record<AdminTaskStatus, string> = {
  todo: "לביצוע",
  in_progress: "בתהליך",
  done: "הושלם",
};
const STATUS_OPTIONS = (Object.keys(STATUS) as AdminTaskStatus[]).map((s) => ({
  value: s,
  label: STATUS[s],
}));

const URGENCY_RANK: Record<TaskUrgency, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};
const STATUS_RANK: Record<AdminTaskStatus, number> = {
  todo: 0,
  in_progress: 1,
  done: 2,
};

type SortBy = "manual" | "status" | "urgency" | "start" | "client" | "project";
const SORT_OPTIONS = [
  { value: "manual", label: "ידני (גרירה)" },
  { value: "status", label: "סטטוס" },
  { value: "urgency", label: "דחיפות" },
  { value: "start", label: "תאריך התחלה" },
  { value: "client", label: "לקוח" },
  { value: "project", label: "פרויקט" },
];

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}
function isOverdue(t: AdminTask) {
  if (!t.end_date || t.status === "done") return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(t.end_date) < today;
}

/* ---------------------------------- page ----------------------------------- */

export default function TaskBoard() {
  const qc = useQueryClient();
  const { data: groups, isLoading: gLoading } = useTaskBoardGroups();
  const { data: tasks, isLoading: tLoading } = useTaskBoardTasks();
  const { data: projects } = useProjects();
  const { data: clients } = useClients();
  const { data: partners } = usePartners();
  const fileRef = useRef<HTMLInputElement>(null);
  const [sortBy, setSortBy] = useState<SortBy>("manual");
  const [groupSortBy, setGroupSortBy] = useState<Record<string, SortBy>>({});

  const [formOpen, setFormOpen] = useState(false);
  const [editTask, setEditTask] = useState<AdminTask | null>(null);
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupTitle, setGroupTitle] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  // The task that just got completed — highlighted for a few seconds so it's
  // clear where it slid to.
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightTimer = useRef<number | null>(null);
  const [confirm, setConfirm] = useState<
    { title: string; description?: string; onConfirm: () => void } | null
  >(null);

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // id → display name, and project → its client, for showing/linking.
  const projectName = useMemo(() => {
    const m = new Map<string, string>();
    (projects ?? []).forEach((p) => m.set(p.id, p.business_name || p.title));
    return m;
  }, [projects]);
  const clientName = useMemo(() => {
    const m = new Map<string, string>();
    (clients?.active ?? []).forEach((c) => m.set(c.id, c.full_name || c.email));
    return m;
  }, [clients]);
  const partnerName = useMemo(() => {
    const m = new Map<string, string>();
    (partners?.active ?? []).forEach((p) => m.set(p.id, p.full_name || p.email));
    return m;
  }, [partners]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["task-board-tasks"] });
    qc.invalidateQueries({ queryKey: ["task-board-groups"] });
  };

  // Done tasks always sink to the bottom; within that, order by the chosen sort
  // (default "manual" = the drag order). Empty client/project sort last.
  const cname = (t: AdminTask) =>
    t.client_id ? clientName.get(t.client_id) || "￿" : "￿";
  const pname = (t: AdminTask) =>
    t.project_id ? projectName.get(t.project_id) || "￿" : "￿";
  const sortTasks = (arr: AdminTask[], by: SortBy) =>
    [...arr].sort((a, b) => {
      const doneDiff = (a.status === "done" ? 1 : 0) - (b.status === "done" ? 1 : 0);
      if (doneDiff) return doneDiff;
      const tie = a.order_index - b.order_index || a.created_at.localeCompare(b.created_at);
      switch (by) {
        case "status":
          return STATUS_RANK[a.status] - STATUS_RANK[b.status] || tie;
        case "urgency":
          return URGENCY_RANK[a.urgency] - URGENCY_RANK[b.urgency] || tie;
        case "start":
          return (
            (a.start_date ?? "9999-99-99").localeCompare(b.start_date ?? "9999-99-99") || tie
          );
        case "client":
          return cname(a).localeCompare(cname(b), "he") || tie;
        case "project":
          return pname(a).localeCompare(pname(b), "he") || tie;
        default:
          return tie;
      }
    });
  // Ungrouped uses the toolbar sort; each group has its own.
  const groupSort = (gid: string): SortBy => groupSortBy[gid] ?? "manual";
  const ungrouped = sortTasks((tasks ?? []).filter((t) => !t.group_id), sortBy);
  const byGroup = (gid: string) =>
    sortTasks((tasks ?? []).filter((t) => t.group_id === gid), groupSort(gid));

  const stats = {
    total: tasks?.length ?? 0,
    open: (tasks ?? []).filter((t) => t.status !== "done").length,
    overdue: (tasks ?? []).filter(isOverdue).length,
  };

  /* --------------------------------- actions -------------------------------- */

  async function setStatus(task: AdminTask, status: AdminTaskStatus) {
    if (status === task.status) return;
    qc.setQueryData<AdminTask[]>(["task-board-tasks"], (prev) =>
      (prev ?? []).map((t) => (t.id === task.id ? { ...t, status } : t))
    );
    // Completing a task slides it to the bottom — flag it so the row glows for
    // a few seconds and Ori can follow where it went.
    if (status === "done") {
      setHighlightId(task.id);
      if (highlightTimer.current) window.clearTimeout(highlightTimer.current);
      highlightTimer.current = window.setTimeout(() => setHighlightId(null), 2800);
    }
    const { error } = await supabase
      .from("admin_tasks")
      .update({ status })
      .eq("id", task.id);
    if (error) {
      toastError("עדכון הסטטוס נכשל.");
      refresh();
    }
  }

  async function setClientInformed(task: AdminTask, informed: boolean) {
    qc.setQueryData<AdminTask[]>(["task-board-tasks"], (prev) =>
      (prev ?? []).map((t) => (t.id === task.id ? { ...t, client_informed: informed } : t))
    );
    const { error } = await supabase
      .from("admin_tasks")
      .update({ client_informed: informed })
      .eq("id", task.id);
    if (error) {
      toastError("העדכון נכשל.");
      refresh();
    }
  }

  function removeTask(task: AdminTask) {
    setConfirm({
      title: "מחיקת משימה",
      description: `למחוק את "${task.title}"?`,
      onConfirm: async () => {
        const { error } = await supabase.from("admin_tasks").delete().eq("id", task.id);
        if (error) return toastError("המחיקה נכשלה.");
        refresh();
      },
    });
  }

  async function toggleCollapse(id: string, next: boolean) {
    qc.setQueryData<AdminTaskGroup[]>(["task-board-groups"], (prev) =>
      (prev ?? []).map((g) => (g.id === id ? { ...g, collapsed: next } : g))
    );
    await supabase.from("admin_task_groups").update({ collapsed: next }).eq("id", id);
  }

  async function addGroup() {
    const title = clampText(groupTitle.trim(), 120);
    if (!title) return toastError("תן שם לקבוצה.");
    const order = (groups?.length ?? 0);
    const { error } = await supabase
      .from("admin_task_groups")
      .insert({ title, order_index: order });
    if (error) return toastError("יצירת הקבוצה נכשלה.");
    setGroupTitle("");
    setGroupOpen(false);
    refresh();
  }

  function removeGroup(id: string, title: string) {
    setConfirm({
      title: "מחיקת קבוצה",
      description: `למחוק את הקבוצה "${title}" ואת כל המשימות שבתוכה?`,
      onConfirm: async () => {
        const { error } = await supabase.from("admin_task_groups").delete().eq("id", id);
        if (error) return toastError("מחיקת הקבוצה נכשלה.");
        // The group's tasks are removed too (DB cascade); reflect it.
        qc.setQueryData<AdminTask[]>(["task-board-tasks"], (prev) =>
          (prev ?? []).filter((t) => t.group_id !== id)
        );
        refresh();
      },
    });
  }

  // Persist a list's new order (drag-and-drop). order_index is per-list.
  async function reorderList(reordered: AdminTask[]) {
    const ids = new Set(reordered.map((t) => t.id));
    const queue = reordered.map((t, i) => ({ ...t, order_index: i }));
    qc.setQueryData<AdminTask[]>(["task-board-tasks"], (prev) => {
      if (!prev) return prev;
      let k = 0;
      return prev.map((t) => (ids.has(t.id) ? queue[k++] : t));
    });
    await Promise.all(
      reordered.map((t, i) =>
        supabase.from("admin_tasks").update({ order_index: i }).eq("id", t.id)
      )
    );
  }

  function bulkDelete() {
    const ids = [...selected];
    if (!ids.length) return;
    setConfirm({
      title: "מחיקת משימות",
      description: `למחוק ${ids.length} משימות שנבחרו?`,
      onConfirm: async () => {
        const { error } = await supabase.from("admin_tasks").delete().in("id", ids);
        if (error) return toastError("המחיקה נכשלה.");
        setSelected(new Set());
        refresh();
      },
    });
  }

  // Tie a group to a project: every task in it inherits the project + its client.
  async function setGroupProject(group: AdminTaskGroup, projectId: string) {
    const project = projects?.find((p) => p.id === projectId);
    const clientId = project?.client_id ?? null;
    qc.setQueryData<AdminTaskGroup[]>(["task-board-groups"], (prev) =>
      (prev ?? []).map((g) =>
        g.id === group.id ? { ...g, project_id: projectId || null } : g
      )
    );
    qc.setQueryData<AdminTask[]>(["task-board-tasks"], (prev) =>
      (prev ?? []).map((t) =>
        t.group_id === group.id
          ? { ...t, project_id: projectId || null, client_id: clientId }
          : t
      )
    );
    const [gRes, tRes] = await Promise.all([
      supabase
        .from("admin_task_groups")
        .update({ project_id: projectId || null })
        .eq("id", group.id),
      supabase
        .from("admin_tasks")
        .update({ project_id: projectId || null, client_id: clientId })
        .eq("group_id", group.id),
    ]);
    if (gRes.error || tRes.error) {
      toastError("שיוך הפרויקט לקבוצה נכשל.");
      refresh();
    }
  }

  function exportCsv() {
    const list = tasks ?? [];
    if (!list.length) return toastError("אין משימות לייצוא.");
    const groupTitleById = new Map((groups ?? []).map((g) => [g.id, g.title]));
    const header = ["שם המשימה", "דחיפות", "סטטוס", "פרוייקט", "לקוח", "שותף", "קבוצה", "התחלה", "סיום", "הערה", "ליידע לקוח", "הוסבר ללקוח"];
    const rows = list.map((t) => [
      t.title,
      URGENCY[t.urgency].label,
      STATUS[t.status],
      t.project_id ? projectName.get(t.project_id) ?? "" : "",
      t.client_id ? clientName.get(t.client_id) ?? "" : "",
      t.partner_id ? partnerName.get(t.partner_id) ?? "" : "",
      t.group_id ? groupTitleById.get(t.group_id) ?? "" : "",
      t.start_date ?? "",
      t.end_date ?? "",
      t.note ?? "",
      t.note_for_client ? "כן" : "",
      t.client_informed ? "כן" : "",
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tasks-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const result = await importCsv(text, {
        projects: projects ?? [],
        partners: (partners?.active ?? []).map((p) => ({
          id: p.id,
          name: p.full_name || p.email,
        })),
        groups: groups ?? [],
      });
      refresh();
      if (result.added === 0) {
        toastError(result.skipped ? "לא נוספו משימות (בדוק את הכותרות בקובץ)." : "הקובץ ריק.");
      } else {
        toast({
          title: `נוספו ${result.added} משימות`,
          description: result.skipped ? `${result.skipped} שורות דולגו` : undefined,
          variant: "success",
        });
      }
    } catch {
      toastError("קריאת הקובץ נכשלה. ודא שזה CSV תקין.");
    }
  }

  const isLoading = gLoading || tLoading;

  return (
    <div>
      <PageHeader
        title="המשימות שלי"
        subtitle="לוח המשימות היומי שלך, גלוי רק לך."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={onFile}
            />
            <div className="flex items-center gap-1.5">
              <ArrowDownUp className="size-4 text-muted-foreground" />
              <div className="w-36">
                <SelectMenu
                  ariaLabel="מיון"
                  value={sortBy}
                  onChange={(v) => setSortBy(v as SortBy)}
                  options={SORT_OPTIONS}
                />
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={exportCsv}>
              <Download className="size-4" /> ייצוא CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" /> ייבוא CSV
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setGroupOpen((v) => !v)}>
              <Plus className="size-4" /> קבוצה
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setEditTask(null);
                setFormOpen(true);
              }}
            >
              <Plus className="size-4" /> משימה חדשה
            </Button>
          </div>
        }
      />

      {/* quick stats */}
      <div className="mb-4 flex flex-wrap gap-2">
        <StatPill label="סה״כ" value={stats.total} />
        <StatPill label="פתוחות" value={stats.open} tone="cyan" />
        <StatPill label="באיחור" value={stats.overdue} tone="destructive" />
      </div>

      {selected.size > 0 && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm">
          <span className="text-foreground">{selected.size} משימות נבחרו</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              ביטול בחירה
            </Button>
            <Button size="sm" variant="destructive" onClick={bulkDelete}>
              <Trash2 className="size-4" /> מחק נבחרות
            </Button>
          </div>
        </div>
      )}

      {groupOpen && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-border bg-background/30 p-3">
          <Input
            autoFocus
            placeholder="שם הקבוצה (לדוגמה: סבב תיקונים 3)"
            maxLength={120}
            value={groupTitle}
            onChange={(e) => setGroupTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addGroup()}
          />
          <Button size="sm" onClick={addGroup}>
            הוספה
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setGroupOpen(false)}>
            ביטול
          </Button>
        </div>
      )}

      {isLoading ? (
        <CenteredLoader label="טוען משימות…" />
      ) : stats.total === 0 && (groups?.length ?? 0) === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="אין עדיין משימות"
          description='הוסף משימה ידנית, צור קבוצה כמו "סבב תיקונים", או ייבא קובץ CSV.'
        />
      ) : (
        <div className="space-y-4">
          {ungrouped.length > 0 && (
            <TaskList
              tasks={ungrouped}
              projectName={projectName}
              clientName={clientName}
              partnerName={partnerName}
              dragDisabled={sortBy !== "manual"}
              selected={selected}
              highlightId={highlightId}
              onToggleSelect={toggleSelect}
              onToggleInformed={setClientInformed}
              onReorder={reorderList}
              onStatus={setStatus}
              onEdit={(t) => {
                setEditTask(t);
                setFormOpen(true);
              }}
              onDelete={removeTask}
            />
          )}

          {(groups ?? []).map((g) => {
            const list = byGroup(g.id);
            const doneCount = list.filter((t) => t.status === "done").length;
            return (
              <Collapsible
                key={g.id}
                open={!g.collapsed}
                onOpenChange={(o) => toggleCollapse(g.id, !o)}
              >
                <Card className="overflow-hidden">
                  <div className="flex items-center justify-between gap-2 px-4 py-3">
                    <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-start">
                      <ChevronDown
                        className={cn(
                          "size-4 shrink-0 text-muted-foreground transition-transform",
                          g.collapsed && "-rotate-90"
                        )}
                      />
                      <span className="truncate font-heading text-base font-semibold text-foreground">
                        {g.title}
                      </span>
                      <Badge variant="secondary">
                        {doneCount}/{list.length}
                      </Badge>
                    </CollapsibleTrigger>
                    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                      <div className="flex items-center gap-1">
                        <ArrowDownUp className="size-3.5 text-muted-foreground" />
                        <div className="w-32">
                          <SelectMenu
                            ariaLabel="מיון הקבוצה"
                            value={groupSort(g.id)}
                            onChange={(v) =>
                              setGroupSortBy((m) => ({ ...m, [g.id]: v as SortBy }))
                            }
                            options={SORT_OPTIONS}
                          />
                        </div>
                      </div>
                      <div className="w-40">
                        <SelectMenu
                          ariaLabel="שיוך הקבוצה לפרויקט"
                          placeholder="שייך לפרויקט…"
                          value={g.project_id ?? ""}
                          onChange={(v) => setGroupProject(g, v)}
                          options={[
                            { value: "", label: "ללא פרויקט" },
                            ...(projects ?? []).map((p) => ({
                              value: p.id,
                              label: p.business_name || p.title,
                            })),
                          ]}
                        />
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive"
                        aria-label="מחיקת קבוצה"
                        onClick={() => removeGroup(g.id, g.title)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </div>
                  <CollapsibleContent>
                    <div className="px-3 pb-3">
                      {list.length === 0 ? (
                        <p className="px-1 pb-1 text-sm text-muted-foreground">
                          אין משימות בקבוצה הזו.
                        </p>
                      ) : (
                        <TaskList
                          tasks={list}
                          projectName={projectName}
                          clientName={clientName}
                          partnerName={partnerName}
                          dragDisabled={groupSort(g.id) !== "manual"}
                          selected={selected}
                          highlightId={highlightId}
                          onToggleSelect={toggleSelect}
                          onToggleInformed={setClientInformed}
                          onReorder={reorderList}
                          onStatus={setStatus}
                          onEdit={(t) => {
                            setEditTask(t);
                            setFormOpen(true);
                          }}
                          onDelete={removeTask}
                        />
                      )}
                    </div>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            );
          })}
        </div>
      )}

      <TaskFormSheet
        open={formOpen}
        onOpenChange={setFormOpen}
        task={editTask}
        projects={projects ?? []}
        partners={(partners?.active ?? []).map((p) => ({
          id: p.id,
          name: p.full_name || p.email,
        }))}
        groups={groups ?? []}
        onSaved={refresh}
      />

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm?.title ?? ""}
        description={confirm?.description}
        onConfirm={() => confirm?.onConfirm()}
      />
    </div>
  );
}

/* -------------------------------- sub-views -------------------------------- */

function StatPill({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "cyan" | "destructive";
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm">
      <span
        className={cn(
          "font-heading font-bold",
          tone === "cyan" && "text-brand-cyan-base",
          tone === "destructive" && "text-destructive",
          !tone && "text-foreground"
        )}
      >
        {value}
      </span>
      <span className="text-muted-foreground">{label}</span>
    </span>
  );
}

function TaskList({
  tasks,
  projectName,
  clientName,
  partnerName,
  dragDisabled,
  selected,
  highlightId,
  onToggleSelect,
  onToggleInformed,
  onReorder,
  onStatus,
  onEdit,
  onDelete,
}: {
  tasks: AdminTask[];
  projectName: Map<string, string>;
  clientName: Map<string, string>;
  partnerName: Map<string, string>;
  dragDisabled: boolean;
  selected: Set<string>;
  highlightId: string | null;
  onToggleSelect: (id: string) => void;
  onToggleInformed: (task: AdminTask, informed: boolean) => void;
  onReorder: (reordered: AdminTask[]) => void;
  onStatus: (task: AdminTask, s: AdminTaskStatus) => void;
  onEdit: (task: AdminTask) => void;
  onDelete: (task: AdminTask) => void;
}) {
  const reduced = usePrefersReducedMotion();
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );
  // Local order so the drag reorder is perfectly in sync with dnd-kit (no jump
  // on release). Re-sync whenever the source list changes (add/edit/delete).
  const [items, setItems] = useState(tasks);
  useEffect(() => setItems(tasks), [tasks]);

  // Framer `layout` is off during a drag (dnd-kit owns it) and on otherwise, so
  // a completed task animates to the bottom without disturbing the drag.
  const [dragging, setDragging] = useState(false);

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    // Keep Framer off through dnd-kit's drop settle, then re-enable next frame.
    requestAnimationFrame(() => setDragging(false));
    if (!over || active.id === over.id) return;
    const oldI = items.findIndex((t) => t.id === active.id);
    const newI = items.findIndex((t) => t.id === over.id);
    if (oldI < 0 || newI < 0) return;
    const reordered = arrayMove(items, oldI, newI);
    setItems(reordered); // instant, in-sync with the drag
    onReorder(reordered); // persist + reconcile the cache
  }

  const renderRow = (t: AdminTask) => (
    <SortableTaskRow
      task={t}
      projectName={t.project_id ? projectName.get(t.project_id) : undefined}
      clientName={t.client_id ? clientName.get(t.client_id) : undefined}
      partnerName={t.partner_id ? partnerName.get(t.partner_id) : undefined}
      dragDisabled={dragDisabled}
      selected={selected.has(t.id)}
      highlight={t.id === highlightId}
      onToggleSelect={() => onToggleSelect(t.id)}
      onToggleInformed={(v) => onToggleInformed(t, v)}
      onStatus={(s) => onStatus(t, s)}
      onEdit={() => onEdit(t)}
      onDelete={() => onDelete(t)}
    />
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={() => setDragging(true)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setDragging(false)}
    >
      <SortableContext items={items.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <div className="space-y-2">
          {items.map((t) =>
            reduced ? (
              <div key={t.id}>{renderRow(t)}</div>
            ) : (
              <motion.div
                key={t.id}
                layout={!dragging}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                {renderRow(t)}
              </motion.div>
            )
          )}
        </div>
      </SortableContext>
    </DndContext>
  );
}

type TaskCardProps = {
  task: AdminTask;
  projectName?: string;
  clientName?: string;
  partnerName?: string;
  dragDisabled?: boolean;
  selected: boolean;
  highlight?: boolean;
  onToggleSelect?: () => void;
  onToggleInformed?: (informed: boolean) => void;
  onStatus?: (s: AdminTaskStatus) => void;
  onEdit?: () => void;
  onDelete?: () => void;
};

/** Sortable wrapper: owns the dnd transform and feeds it to the visual card. */
function SortableTaskRow(props: TaskCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: props.task.id,
      animateLayoutChanges,
      disabled: props.dragDisabled,
    });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <TaskCard
      {...props}
      setNodeRef={setNodeRef}
      style={style}
      dragHandle={{ ...attributes, ...listeners }}
      dragging={isDragging}
    />
  );
}

/** Presentational row used by the sortable wrapper. */
function TaskCard({
  task,
  projectName,
  clientName,
  partnerName,
  dragDisabled,
  selected,
  highlight,
  onToggleSelect,
  onToggleInformed,
  onStatus,
  onEdit,
  onDelete,
  setNodeRef,
  style,
  dragHandle,
  dragging,
}: TaskCardProps & {
  setNodeRef?: (el: HTMLElement | null) => void;
  style?: React.CSSProperties;
  dragHandle?: Record<string, unknown>;
  dragging?: boolean;
}) {
  const done = task.status === "done";
  const overdue = isOverdue(task);

  let dates = "";
  if (task.start_date && task.end_date)
    dates = `${fmtDate(task.start_date)} עד ${fmtDate(task.end_date)}`;
  else if (task.end_date) dates = `עד ${fmtDate(task.end_date)}`;
  else if (task.start_date) dates = `מ-${fmtDate(task.start_date)}`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 transition-[background-color,box-shadow,border-color,opacity] duration-700",
        dragging && "relative z-10 shadow-lift",
        // Completed → faded "disabled" look so it's clearly done.
        done && "opacity-55",
        highlight
          ? "border-primary bg-primary/10 opacity-100 shadow-[0_0_0_2px_var(--primary)]"
          : selected
            ? "border-primary/50 bg-field ring-1 ring-primary/30"
            : done
              ? "border-border/60 bg-field/50"
              : task.status === "in_progress"
                ? // In progress → stands out: green tint + breathing green ring.
                  "task-breathe border-primary/40 bg-primary/[0.07]"
                : "border-border bg-field"
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {!dragDisabled && (
          <button
            {...((dragHandle ?? {}) as React.ButtonHTMLAttributes<HTMLButtonElement>)}
            type="button"
            aria-label="גרירה לסידור"
            className="shrink-0 cursor-grab touch-none text-muted-foreground/50 transition-colors hover:text-muted-foreground"
          >
            <GripVertical className="size-4" />
          </button>
        )}
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect?.()}
          aria-label="בחירת משימה"
          className="size-4 shrink-0 accent-[var(--primary)]"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge variant={URGENCY[task.urgency].variant}>
              {URGENCY[task.urgency].label}
            </Badge>
            <span
              className={cn(
                "truncate font-medium",
                done ? "text-muted-foreground line-through" : "text-foreground"
              )}
            >
              {task.title}
            </span>
          </div>
          {(projectName || clientName || partnerName || dates) && (
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {projectName && task.project_id && (
                <Link
                  to={`/projects/${task.project_id}`}
                  className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
                >
                  <FolderKanban className="size-3.5 text-brand-cyan-base" />
                  {projectName}
                </Link>
              )}
              {clientName && task.client_id && (
                <Link
                  to={`/admin/clients/${task.client_id}`}
                  className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
                >
                  <User className="size-3.5" />
                  {clientName}
                </Link>
              )}
              {partnerName && task.partner_id && (
                <Link
                  to={`/admin/partners/${task.partner_id}`}
                  className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
                >
                  <Handshake className="size-3.5 text-brand-cyan-base" />
                  {partnerName}
                </Link>
              )}
              {dates && (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5",
                    overdue
                      ? "border-destructive/40 font-semibold text-destructive"
                      : "border-border text-foreground/80"
                  )}
                >
                  <CalendarClock className="size-3.5" />
                  {dates}
                  {overdue ? " (באיחור)" : ""}
                </span>
              )}
            </div>
          )}
          {task.note_for_client && (
            <button
              type="button"
              onClick={() => onToggleInformed?.(!task.client_informed)}
              className={cn(
                "mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                task.client_informed
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-amber-400/50 bg-amber-400/10 text-amber-500 hover:bg-amber-400/20"
              )}
              title={
                task.client_informed
                  ? "סומן שהוסבר ללקוח — לחץ לביטול"
                  : "הערה ליידוע הלקוח — לחץ לסמן שהוסבר"
              }
            >
              {task.client_informed ? (
                <>
                  <Check className="size-3" /> הוסבר ללקוח
                </>
              ) : (
                <>
                  <Megaphone className="size-3" /> ליידע לקוח
                </>
              )}
            </button>
          )}
          {task.note && (
            <p className="mt-1 flex items-start gap-1 text-xs italic text-muted-foreground">
              <StickyNote className="mt-0.5 size-3.5 shrink-0" />
              <span className="line-clamp-2">{task.note}</span>
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <SelectMenu
          ariaLabel="סטטוס"
          value={task.status}
          onChange={(v) => onStatus?.(v as AdminTaskStatus)}
          options={STATUS_OPTIONS}
        />
        <Button variant="ghost" size="icon" className="size-8" aria-label="עריכה" onClick={onEdit}>
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-8 text-destructive"
          aria-label="מחיקה"
          onClick={onDelete}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function TaskFormSheet({
  open,
  onOpenChange,
  task,
  projects,
  partners,
  groups,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  task: AdminTask | null;
  projects: { id: string; title: string; business_name: string | null; client_id: string }[];
  partners: { id: string; name: string }[];
  groups: { id: string; title: string; project_id: string | null }[];
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [seededId, setSeededId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState({
    title: "",
    urgency: "medium" as TaskUrgency,
    project_id: "",
    partner_id: "",
    group_id: "",
    start_date: "",
    end_date: "",
    note: "",
    note_for_client: false,
    client_informed: false,
  });

  // Re-seed whenever the sheet opens for a different task (or for a new one).
  const wantSeed = open ? task?.id ?? "new" : null;
  if (wantSeed !== seededId) {
    setSeededId(wantSeed);
    setDraft({
      title: task?.title ?? "",
      urgency: task?.urgency ?? "medium",
      project_id: task?.project_id ?? "",
      partner_id: task?.partner_id ?? "",
      group_id: task?.group_id ?? "",
      start_date: task?.start_date ?? "",
      end_date: task?.end_date ?? "",
      note: task?.note ?? "",
      note_for_client: task?.note_for_client ?? false,
      client_informed: task?.client_informed ?? false,
    });
  }

  const projectOptions = [
    { value: "", label: "ללא פרויקט" },
    ...projects.map((p) => ({ value: p.id, label: p.business_name || p.title })),
  ];
  const partnerOptions = [
    { value: "", label: "ללא שותף" },
    ...partners.map((p) => ({ value: p.id, label: p.name })),
  ];
  const groupOptions = [
    { value: "", label: "ללא קבוצה" },
    ...groups.map((g) => ({ value: g.id, label: g.title })),
  ];

  async function save() {
    const title = clampText(draft.title.trim(), 200);
    if (!title) return toastError("תן שם למשימה.");
    const project = projects.find((p) => p.id === draft.project_id);
    const payload = {
      title,
      urgency: draft.urgency,
      project_id: draft.project_id || null,
      client_id: project?.client_id ?? null,
      partner_id: draft.partner_id || null,
      group_id: draft.group_id || null,
      start_date: draft.start_date || null,
      end_date: draft.end_date || null,
      note: clampText(draft.note.trim(), 2000) || null,
      note_for_client: draft.note.trim() ? draft.note_for_client : false,
      client_informed:
        draft.note.trim() && draft.note_for_client ? draft.client_informed : false,
    };

    setSaving(true);
    // New tasks append to the end of their list (large order_index).
    const { error } = task
      ? await supabase.from("admin_tasks").update(payload).eq("id", task.id)
      : await supabase
          .from("admin_tasks")
          .insert({ ...payload, order_index: Math.floor(Date.now() / 1000) });
    setSaving(false);
    if (error) return toastError("שמירת המשימה נכשלה.");
    toast({ title: task ? "המשימה עודכנה" : "המשימה נוספה", variant: "success" });
    onSaved();
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{task ? "עריכת משימה" : "משימה חדשה"}</SheetTitle>
          <SheetDescription>
            הלוח גלוי רק לך. הלקוח נמשך אוטומטית מהפרויקט המשויך.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="t-title">שם המשימה</Label>
            <Input
              id="t-title"
              value={draft.title}
              maxLength={200}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
              placeholder="לדוגמה: תיקון באג בצ׳קאאוט"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="t-urgency">דחיפות</Label>
              <SelectMenu
                id="t-urgency"
                variant="field"
                ariaLabel="דחיפות"
                value={draft.urgency}
                onChange={(v) => setDraft((d) => ({ ...d, urgency: v as TaskUrgency }))}
                options={URGENCY_OPTIONS}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-group">קבוצה</Label>
              <SelectMenu
                id="t-group"
                variant="field"
                ariaLabel="קבוצה"
                value={draft.group_id}
                onChange={(v) =>
                  setDraft((d) => {
                    // Picking a group that's tied to a project pre-fills the
                    // project (unless one was already chosen).
                    const g = groups.find((x) => x.id === v);
                    return {
                      ...d,
                      group_id: v,
                      project_id:
                        !d.project_id && g?.project_id ? g.project_id : d.project_id,
                    };
                  })
                }
                options={groupOptions}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="t-project">פרויקט משויך</Label>
            <SelectMenu
              id="t-project"
              variant="field"
              ariaLabel="פרויקט"
              placeholder="בחר פרויקט…"
              value={draft.project_id}
              onChange={(v) => setDraft((d) => ({ ...d, project_id: v }))}
              options={projectOptions}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="t-partner">שותף משויך</Label>
            <SelectMenu
              id="t-partner"
              variant="field"
              ariaLabel="שותף"
              placeholder="בחר שותף…"
              value={draft.partner_id}
              onChange={(v) => setDraft((d) => ({ ...d, partner_id: v }))}
              options={partnerOptions}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="t-start">תאריך התחלה</Label>
              <Input
                id="t-start"
                type="date"
                value={draft.start_date}
                onChange={(e) => setDraft((d) => ({ ...d, start_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="t-end">תאריך סיום</Label>
              <Input
                id="t-end"
                type="date"
                value={draft.end_date}
                onChange={(e) => setDraft((d) => ({ ...d, end_date: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="t-note">הערה</Label>
            <Textarea
              id="t-note"
              value={draft.note}
              maxLength={2000}
              rows={3}
              placeholder="מה עשיתי / מידע נוסף (אופציונלי)"
              onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
            />
            {draft.note.trim() && (
              <div className="grid grid-cols-2 items-end gap-3 pt-1">
                <div className="space-y-1.5">
                  <Label htmlFor="t-note-type">סוג ההערה</Label>
                  <SelectMenu
                    id="t-note-type"
                    variant="field"
                    ariaLabel="סוג ההערה"
                    value={draft.note_for_client ? "client" : "private"}
                    onChange={(v) =>
                      setDraft((d) => ({ ...d, note_for_client: v === "client" }))
                    }
                    options={[
                      { value: "private", label: "פרטית" },
                      { value: "client", label: "ליידוע הלקוח" },
                    ]}
                  />
                </div>
                {draft.note_for_client && (
                  <label className="flex items-center gap-2 pb-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={draft.client_informed}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, client_informed: e.target.checked }))
                      }
                      className="size-4 accent-[var(--primary)]"
                    />
                    הוסבר ללקוח
                  </label>
                )}
              </div>
            )}
          </div>
        </div>

        <SheetFooter>
          <Button onClick={save} disabled={saving}>
            {saving ? "שומר…" : "שמירה"}
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ---------------------------- CSV import / export -------------------------- */

/** Quote a CSV cell when it contains a comma, quote or newline. */
function csvCell(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/** Minimal RFC-4180-ish CSV parser (handles quoted fields + escaped quotes). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const t = text.replace(/^﻿/, ""); // strip BOM
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (inQuotes) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    if (row.some((x) => x.trim() !== "")) rows.push(row);
  }
  return rows;
}

const HEADER_ALIASES: Record<string, string[]> = {
  title: ["שם המשימה", "שם", "משימה", "title", "task"],
  urgency: ["דחיפות", "עדיפות", "urgency", "priority"],
  project: ["פרויקט", "פרוייקט", "project"],
  start: ["תאריך התחלה", "התחלה", "start", "start_date"],
  end: ["תאריך סיום", "סיום", "דדליין", "end", "end_date", "due"],
  group: ["קבוצה", "סבב", "group"],
  partner: ["שותף", "שת\"פ", "partner"],
  note: ["הערה", "הערות", "note", "comment"],
  note_for_client: ["ליידע לקוח", "הערה ללקוח", "note_for_client"],
  client_informed: ["הוסבר ללקוח", "הוסבר", "client_informed"],
};

/** Loose truthy check for CSV yes/no cells. */
function csvTruthy(v: string): boolean {
  return /^(כן|yes|true|1|✓|v)$/i.test(v.trim());
}

function matchHeader(h: string): string | null {
  const n = h.trim().toLowerCase();
  for (const key of Object.keys(HEADER_ALIASES)) {
    if (HEADER_ALIASES[key].some((a) => a.toLowerCase() === n)) return key;
  }
  return null;
}

const URGENCY_FROM_HE: Record<string, TaskUrgency> = {
  נמוכה: "low",
  נמוך: "low",
  בינונית: "medium",
  בינוני: "medium",
  רגילה: "medium",
  גבוהה: "high",
  גבוה: "high",
  דחוף: "urgent",
  דחופה: "urgent",
  low: "low",
  medium: "medium",
  high: "high",
  urgent: "urgent",
};

/** Parse YYYY-MM-DD, DD/MM/YYYY or DD.MM.YYYY → ISO date (YYYY-MM-DD) or null. */
function parseDate(s: string): string | null {
  const v = s.trim();
  if (!v) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const m = v.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const yyyy = y.length === 2 ? `20${y}` : y;
    return `${yyyy}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

interface ImportCtx {
  projects: { id: string; title: string; business_name: string | null; client_id: string }[];
  partners: { id: string; name: string }[];
  groups: { id: string; title: string }[];
}

async function importCsv(
  text: string,
  ctx: ImportCtx
): Promise<{ added: number; skipped: number }> {
  const rows = parseCsv(text);
  if (rows.length < 2) return { added: 0, skipped: 0 };

  const headers = rows[0].map(matchHeader);
  const idx = (key: string) => headers.indexOf(key);
  const ti = idx("title");
  if (ti === -1) return { added: 0, skipped: rows.length - 1 }; // no title column → can't import

  // Resolve / create groups by title (case-insensitive), reusing existing ones.
  const groupId = new Map<string, string>();
  ctx.groups.forEach((g) => groupId.set(g.title.trim().toLowerCase(), g.id));

  const findProject = (name: string) => {
    const n = name.trim().toLowerCase();
    if (!n) return undefined;
    return ctx.projects.find(
      (p) =>
        (p.business_name || "").trim().toLowerCase() === n ||
        p.title.trim().toLowerCase() === n
    );
  };
  const findPartner = (name: string) => {
    const n = name.trim().toLowerCase();
    if (!n) return undefined;
    return ctx.partners.find((p) => p.name.trim().toLowerCase() === n);
  };

  type NewTask = {
    title: string;
    urgency: TaskUrgency;
    project_id: string | null;
    client_id: string | null;
    partner_id: string | null;
    start_date: string | null;
    end_date: string | null;
    note: string | null;
    note_for_client: boolean;
    client_informed: boolean;
    groupKey: string | null; // lowercase title, resolved to id after group creation
  };
  const newTasks: NewTask[] = [];
  const neededGroups = new Set<string>();
  let skipped = 0;

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const title = clampText((cells[ti] ?? "").trim(), 200);
    if (!title) {
      skipped++;
      continue;
    }
    const get = (key: string) => {
      const i = idx(key);
      return i === -1 ? "" : (cells[i] ?? "").trim();
    };
    const urgency = URGENCY_FROM_HE[get("urgency").toLowerCase()] ?? "medium";
    const project = findProject(get("project"));
    const partner = findPartner(get("partner"));
    const groupRaw = get("group");
    const groupKey = groupRaw ? groupRaw.trim().toLowerCase() : null;
    if (groupKey && !groupId.has(groupKey)) neededGroups.add(groupRaw.trim());
    newTasks.push({
      title,
      urgency,
      project_id: project?.id ?? null,
      client_id: project?.client_id ?? null,
      partner_id: partner?.id ?? null,
      start_date: parseDate(get("start")),
      end_date: parseDate(get("end")),
      note: clampText(get("note"), 2000) || null,
      note_for_client: csvTruthy(get("note_for_client")),
      client_informed: csvTruthy(get("client_informed")),
      groupKey,
    });
  }

  // Create any missing groups, then map their ids back.
  if (neededGroups.size) {
    const base = ctx.groups.length;
    const toInsert = [...neededGroups].map((title, i) => ({
      title,
      order_index: base + i,
    }));
    const { data: created } = await supabase
      .from("admin_task_groups")
      .insert(toInsert)
      .select("id, title");
    (created ?? []).forEach((g) => groupId.set(g.title.trim().toLowerCase(), g.id));
  }

  const payload = newTasks.map((t) => ({
    title: t.title,
    urgency: t.urgency,
    project_id: t.project_id,
    client_id: t.client_id,
    partner_id: t.partner_id,
    start_date: t.start_date,
    end_date: t.end_date,
    note: t.note,
    note_for_client: t.note_for_client,
    client_informed: t.client_informed,
    group_id: t.groupKey ? groupId.get(t.groupKey) ?? null : null,
  }));

  if (!payload.length) return { added: 0, skipped };
  const { error } = await supabase.from("admin_tasks").insert(payload);
  if (error) return { added: 0, skipped };
  return { added: payload.length, skipped };
}
