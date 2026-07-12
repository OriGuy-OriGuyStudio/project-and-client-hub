import { useEffect, useState } from "react";
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
import { useBusinesses } from "@/hooks/useBusinesses";
import { useAdminOrgMembers, orgMemberLabel } from "@/hooks/useOrg";
import { groupProjects } from "@/lib/projectGroups";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { projectStatusHe } from "@/lib/status";
import type { BusinessRow, ProjectStatus } from "@/types/database";

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

/** Sort order for the business picker: real clients first, then the amber
 * "demo" testers, then the studio's own internal org - same grouping as the
 * Businesses list page, flattened into one select. */
const KIND_ORDER: Record<BusinessRow["kind"], number> = { real: 0, demo: 1, studio: 2 };
const KIND_SUFFIX: Record<BusinessRow["kind"], string> = { real: "", demo: " (דמה)", studio: " (סטודיו)" };

function CreateProjectDialog() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: businesses } = useBusinesses();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    org_id: "",
    client_id: "",
    title: "",
    description: "",
    status: "active" as ProjectStatus,
    warranty_start_date: "",
  });

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const businessOptions = [...(businesses ?? [])]
    .sort((a, b) => KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.name.localeCompare(b.name, "he"))
    .map((b) => ({ value: b.id, label: `${b.name}${KIND_SUFFIX[b.kind]}` }));

  // The chosen business's members - the only valid "responsible contact"
  // candidates (the Task-12 trigger rejects any client_id outside org_id).
  const { data: orgMembers, isLoading: membersLoading } = useAdminOrgMembers(form.org_id || null);
  const memberOptions = (orgMembers ?? [])
    .filter((m): m is typeof m & { user_id: string } => !!m.user_id)
    .map((m) => ({ value: m.user_id, label: orgMemberLabel(m) }));

  // Default the contact once the business's members load: prefer a manager,
  // else the founding member (the members RPC sorts real members oldest-first).
  useEffect(() => {
    if (!form.org_id) return;
    if (form.client_id && memberOptions.some((m) => m.value === form.client_id)) return;
    const preferred = (orgMembers ?? []).find((m) => m.user_id && m.is_manager) ?? (orgMembers ?? []).find((m) => m.user_id);
    update("client_id", preferred?.user_id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.org_id, orgMembers]);

  async function save() {
    if (!form.org_id) return toastError("בחר עסק לפרויקט.");
    if (!form.client_id) return toastError("בחר איש קשר אחראי מטעם העסק.");
    const title = clampText(form.title.trim(), 200);
    if (!title) return toastError("תן שם לפרויקט.");

    setSaving(true);
    const { data, error } = await supabase
      .from("projects")
      .insert({
        org_id: form.org_id,
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
            שייך את הפרויקט לעסק קיים ובחר מי מטעמו יהיה איש הקשר האחראי. אם
            העסק עדיין לא מופיע, ודא שהמנהל/ת שלו התחבר/ה פעם אחת.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="p-business">עסק</Label>
            {businessOptions.length === 0 ? (
              <p className="rounded-xl border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                אין עדיין עסקים. הוסף עסק ותן למנהל/ת שלו להתחבר פעם אחת.
              </p>
            ) : (
              <SelectMenu
                id="p-business"
                variant="field"
                ariaLabel="עסק"
                placeholder="בחר עסק…"
                value={form.org_id}
                onChange={(v) => update("org_id", v)}
                options={businessOptions}
              />
            )}
          </div>

          {form.org_id && (
            <div className="space-y-1.5">
              <Label htmlFor="p-client">איש קשר אחראי</Label>
              {membersLoading ? (
                <p className="rounded-xl border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                  טוען חברי צוות…
                </p>
              ) : memberOptions.length === 0 ? (
                <p className="rounded-xl border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
                  אין עדיין איש קשר עם גישה לעסק הזה.
                </p>
              ) : (
                <SelectMenu
                  id="p-client"
                  variant="field"
                  ariaLabel="איש קשר אחראי"
                  placeholder="בחר איש קשר…"
                  value={form.client_id}
                  onChange={(v) => update("client_id", v)}
                  options={memberOptions}
                />
              )}
            </div>
          )}

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
          <Button onClick={save} disabled={saving || businessOptions.length === 0}>
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
