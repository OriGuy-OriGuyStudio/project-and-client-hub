import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectMenu } from "@/components/ui/select-menu";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { supabase } from "@/lib/supabase";
import { toast, toastError } from "@/hooks/use-toast";
import { clampText } from "@/lib/sanitize";
import { logActivity } from "@/lib/activity";
import { useAuth } from "@/hooks/useAuth";
import { useClients } from "@/hooks/useClients";
import { projectStatusHe } from "@/lib/status";
import type { Project, ProjectStatus } from "@/types/database";

const STATUSES: ProjectStatus[] = ["active", "on_hold", "completed", "cancelled"];

/**
 * Admin-only "edit project details" panel — name, description, status, and the
 * warranty start date (setting/clearing it starts or stops the warranty clock).
 * The link fields live in ProjectHero's own inline editor.
 */
export function EditProjectSheet({ project }: { project: Project }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: clients } = useClients();
  const activeClients = clients?.active ?? [];
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    client_id: project.client_id,
    title: project.title,
    description: project.description ?? "",
    status: project.status,
    warranty_start_date: project.warranty_start_date ?? "",
  });

  function update<K extends keyof typeof draft>(k: K, v: (typeof draft)[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  async function save() {
    const title = clampText(draft.title.trim(), 200);
    if (!title) return toastError("תן שם לפרויקט.");

    setSaving(true);
    const { error } = await supabase
      .from("projects")
      .update({
        client_id: draft.client_id,
        title,
        description: clampText(draft.description.trim(), 2000) || null,
        status: draft.status,
        warranty_start_date: draft.warranty_start_date || null,
      })
      .eq("id", project.id);
    setSaving(false);

    if (error) return toastError("שמירת הפרטים נכשלה.");

    await logActivity({
      projectId: project.id,
      actorId: user?.id ?? null,
      actionType: "project_updated",
      description: `פרטי הפרויקט עודכנו (${title})`,
    });
    toast({ title: "הפרטים נשמרו", variant: "success" });
    qc.invalidateQueries({ queryKey: ["project", project.id] });
    qc.invalidateQueries({ queryKey: ["projects"] });
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Pencil className="size-4" /> עריכת פרטים
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>עריכת פרטי הפרויקט</SheetTitle>
          <SheetDescription>
            שם, תיאור, סטטוס ותאריך תחילת האחריות. לעריכת הקישורים השתמש ב״עריכת
            קישורים״ בכרטיס הפרויקט.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ep-client">לקוח משויך</Label>
            <SelectMenu
              id="ep-client"
              variant="field"
              ariaLabel="לקוח"
              placeholder="בחר לקוח…"
              value={draft.client_id}
              onChange={(v) => update("client_id", v)}
              options={activeClients.map((c) => ({
                value: c.id,
                label: c.full_name ? `${c.full_name} · ${c.email}` : c.email,
              }))}
            />
            <p className="text-xs text-muted-foreground">
              שינוי הלקוח מעביר את הפרויקט לחשבון אחר, והלקוח הקודם יפסיק לראות אותו.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ep-title">שם הפרויקט</Label>
            <Input
              id="ep-title"
              value={draft.title}
              maxLength={200}
              onChange={(e) => update("title", e.target.value)}
              placeholder="לדוגמה: אתר תדמית"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ep-desc">תיאור</Label>
            <Textarea
              id="ep-desc"
              value={draft.description}
              maxLength={2000}
              onChange={(e) => update("description", e.target.value)}
              placeholder="כמה מילים על הפרויקט"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ep-status">סטטוס</Label>
              <SelectMenu
                id="ep-status"
                variant="field"
                ariaLabel="סטטוס"
                value={draft.status}
                onChange={(v) => update("status", v as ProjectStatus)}
                options={STATUSES.map((s) => ({
                  value: s,
                  label: projectStatusHe[s],
                }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-warranty">תחילת אחריות</Label>
              <Input
                id="ep-warranty"
                type="date"
                value={draft.warranty_start_date}
                onChange={(e) => update("warranty_start_date", e.target.value)}
              />
            </div>
          </div>
        </div>

        <SheetFooter>
          <Button onClick={save} disabled={saving}>
            {saving ? "שומר…" : "שמירה"}
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            ביטול
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
