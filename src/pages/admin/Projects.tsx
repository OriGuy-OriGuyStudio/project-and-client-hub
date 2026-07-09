import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { FolderKanban, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { ProjectSections } from "@/components/project/ProjectSections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CenteredLoader } from "@/components/ui/brand-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectMenu } from "@/components/ui/select-menu";
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
import { useProjects } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { groupProjects } from "@/lib/projectGroups";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { projectStatusHe } from "@/lib/status";
import type { ProjectStatus } from "@/types/database";

export default function Projects() {
  const { data: projects, isLoading } = useProjects();
  const { data: clients } = useClients();
  const { unreadProjectIds } = useNotifications();

  const all = projects ?? [];
  const groups = groupProjects(all, clients?.active);

  return (
    <div>
      <PageHeader
        title="פרויקטים"
        subtitle="פרויקטים של לקוחות ופרויקטים פנימיים של הסטודיו, בנפרד."
        actions={<CreateProjectDialog />}
      />

      {isLoading ? (
        <CenteredLoader label="טוען פרויקטים…" />
      ) : all.length > 0 ? (
        <ProjectSections groups={groups} unread={unreadProjectIds} />
      ) : (
        <EmptyState
          icon={FolderKanban}
          title="אין עדיין פרויקטים"
          description="צור פרויקט ראשון ושייך אותו לאחד הלקוחות."
          action={<CreateProjectDialog />}
        />
      )}
    </div>
  );
}

const STATUSES: ProjectStatus[] = ["active", "on_hold", "completed", "cancelled"];

function CreateProjectDialog() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: clients } = useClients();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    client_id: "",
    title: "",
    description: "",
    status: "active" as ProjectStatus,
    warranty_start_date: "",
  });

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const activeClients = clients?.active ?? [];

  async function save() {
    if (!form.client_id) return toastError("בחר לקוח לפרויקט.");
    const title = clampText(form.title.trim(), 200);
    if (!title) return toastError("תן שם לפרויקט.");

    setSaving(true);
    const { data, error } = await supabase
      .from("projects")
      .insert({
        client_id: form.client_id,
        title,
        description: clampText(form.description.trim(), 2000) || null,
        status: form.status,
        warranty_start_date: form.warranty_start_date || null,
      })
      .select("id")
      .single();
    setSaving(false);

    if (error || !data) return toastError("יצירת הפרויקט נכשלה.");

    await logActivity({
      projectId: data.id,
      actorId: user?.id ?? null,
      actionType: "project_created",
      description: `הפרויקט "${title}" נוצר`,
    });
    toast({ title: "הפרויקט נוצר", variant: "success" });
    qc.invalidateQueries({ queryKey: ["projects"] });
    setOpen(false);
    navigate(`/projects/${data.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> פרויקט חדש
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>פרויקט חדש</DialogTitle>
          <DialogDescription>
            שייך את הפרויקט ללקוח קיים. אם הלקוח עדיין לא מופיע, ודא שהוא התחבר
            פעם אחת.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="p-client">לקוח</Label>
            {activeClients.length === 0 ? (
              <p className="rounded-xl border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                אין עדיין לקוחות פעילים. הוסף לקוח ותן לו להתחבר פעם אחת.
              </p>
            ) : (
              <SelectMenu
                id="p-client"
                variant="field"
                ariaLabel="לקוח"
                placeholder="בחר לקוח…"
                value={form.client_id}
                onChange={(v) => update("client_id", v)}
                options={activeClients.map((c) => ({
                  value: c.id,
                  label: c.full_name ? `${c.full_name} · ${c.email}` : c.email,
                }))}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-title">שם הפרויקט</Label>
            <Input
              id="p-title"
              value={form.title}
              maxLength={200}
              onChange={(e) => update("title", e.target.value)}
              placeholder="לדוגמה: אתר תדמית"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="p-desc">תיאור</Label>
            <Textarea
              id="p-desc"
              value={form.description}
              maxLength={2000}
              onChange={(e) => update("description", e.target.value)}
              placeholder="כמה מילים על הפרויקט"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-status">סטטוס</Label>
              <SelectMenu
                id="p-status"
                variant="field"
                ariaLabel="סטטוס"
                value={form.status}
                onChange={(v) => update("status", v)}
                options={STATUSES.map((s) => ({
                  value: s,
                  label: projectStatusHe[s],
                }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-warranty">תחילת אחריות</Label>
              <Input
                id="p-warranty"
                type="date"
                value={form.warranty_start_date}
                onChange={(e) => update("warranty_start_date", e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={saving || activeClients.length === 0}>
            {saving ? "יוצר…" : "יצירה"}
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
