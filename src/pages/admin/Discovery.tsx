import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardList, Plus, ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectMenu } from "@/components/ui/select-menu";
import { CenteredLoader } from "@/components/ui/brand-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/sheet";
import { supabase } from "@/lib/supabase";
import { toast, toastError } from "@/hooks/use-toast";
import { clampText } from "@/lib/sanitize";
import { useClients } from "@/hooks/useClients";
import { useProjects } from "@/hooks/useProjects";
import { useBusinesses } from "@/hooks/useBusinesses";
import { useAdminOrgMembers } from "@/hooks/useOrg";
import { DISCOVERY_TEMPLATES, templateByKey } from "@/lib/discovery";
import { cn } from "@/lib/utils";
import type { DiscoverySession } from "@/types/database";

export default function Discovery() {
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["discovery-sessions"],
    queryFn: async (): Promise<DiscoverySession[]> => {
      const { data, error } = await supabase
        .from("discovery_sessions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: clients } = useClients();
  const { data: projects } = useProjects();
  const { data: businesses } = useBusinesses();

  const clientName = useMemo(() => {
    const m = new Map<string, string>();
    (clients?.active ?? []).forEach((c) => m.set(c.id, c.full_name || c.email));
    return m;
  }, [clients]);
  const orgName = useMemo(() => {
    const m = new Map<string, string>();
    (businesses ?? []).forEach((b) => m.set(b.id, b.name));
    return m;
  }, [businesses]);
  const projectName = useMemo(() => {
    const m = new Map<string, string>();
    (projects ?? []).forEach((p) => m.set(p.id, p.business_name || p.title));
    return m;
  }, [projects]);

  return (
    <div>
      <PageHeader
        title="שיחות אפיון"
        subtitle="תיעוד שיחות היכרות ואפיון מובנות, עם סיכום לשיתוף."
        actions={<NewSessionDialog />}
      />

      {isLoading ? (
        <CenteredLoader label="טוען שיחות…" />
      ) : !sessions?.length ? (
        <EmptyState
          icon={ClipboardList}
          title="אין עדיין שיחות אפיון"
          description="פתח שיחה חדשה, מלא את השאלון, וקבל סיכום מסודר לשיתוף."
          action={<NewSessionDialog />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sessions.map((s) => (
            <Link key={s.id} to={`/admin/discovery/${s.id}`} className="block">
              <Card className="group h-full p-5 transition-colors hover:border-primary/40">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="min-w-0 truncate font-heading text-base font-semibold text-foreground">
                    {s.title}
                  </h3>
                  <Badge variant={s.status === "done" ? "success" : "warning"}>
                    {s.status === "done" ? "הושלם" : "טיוטה"}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {templateByKey(s.template_key).label}
                  {s.org_id && orgName.get(s.org_id)
                    ? ` · ${orgName.get(s.org_id)}`
                    : s.client_id && clientName.get(s.client_id)
                      ? ` · ${clientName.get(s.client_id)}`
                      : ""}
                  {s.project_id && projectName.get(s.project_id)
                    ? ` · ${projectName.get(s.project_id)}`
                    : ""}
                </p>
                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span>{new Date(s.created_at).toLocaleDateString("he-IL")}</span>
                  <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-1" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function NewSessionDialog() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: projects } = useProjects();
  const { data: businesses } = useBusinesses();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    template_key: "landing",
    org_id: "",
    attendee_ids: [] as string[],
    project_id: "",
  });
  const { data: orgMembers } = useAdminOrgMembers(form.org_id || null);

  const toggleAttendee = (uid: string) =>
    setForm((f) => ({
      ...f,
      attendee_ids: f.attendee_ids.includes(uid)
        ? f.attendee_ids.filter((x) => x !== uid)
        : [...f.attendee_ids, uid],
    }));

  async function save() {
    const title = clampText(form.title.trim(), 160);
    if (!title) return toastError("תן שם לשיחה (למשל שם העסק).");
    setSaving(true);
    const { data, error } = await supabase
      .from("discovery_sessions")
      .insert({
        title,
        template_key: form.template_key,
        org_id: form.org_id || null,
        attendee_ids: form.org_id ? form.attendee_ids : [],
        project_id: form.org_id ? form.project_id || null : null,
      })
      .select("id")
      .single();
    setSaving(false);
    if (error || !data) return toastError("יצירת השיחה נכשלה.");
    toast({ title: "השיחה נוצרה", variant: "success" });
    qc.invalidateQueries({ queryKey: ["discovery-sessions"] });
    setOpen(false);
    navigate(`/admin/discovery/${data.id}`);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> שיחה חדשה
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>שיחת אפיון חדשה</DialogTitle>
          <DialogDescription>
            בחר תבנית שאלון. אפשר לשייך לעסק, לנוכחים ולפרויקט (לא חובה).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="d-title">שם השיחה</Label>
            <Input
              id="d-title"
              value={form.title}
              maxLength={160}
              placeholder="לדוגמה: מאפיית לחם הארץ"
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="d-template">סוג הפרויקט</Label>
            <SelectMenu
              id="d-template"
              variant="field"
              ariaLabel="סוג הפרויקט"
              value={form.template_key}
              onChange={(v) => setForm((f) => ({ ...f, template_key: v }))}
              options={DISCOVERY_TEMPLATES.map((t) => ({ value: t.key, label: t.label }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="d-org">עסק</Label>
            <SelectMenu
              id="d-org"
              variant="field"
              ariaLabel="עסק"
              placeholder="ללא"
              value={form.org_id}
              onChange={(v) =>
                setForm((f) => ({ ...f, org_id: v, attendee_ids: [], project_id: "" }))
              }
              options={[
                { value: "", label: "ללא עסק (ליד)" },
                ...(businesses ?? []).map((b) => ({ value: b.id, label: b.name })),
              ]}
            />
          </div>

          {form.org_id && (
            <div className="space-y-1.5">
              <Label>מי היה בשיחה</Label>
              {orgMembers && orgMembers.filter((m) => m.user_id).length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {orgMembers
                    .filter((m) => m.user_id)
                    .map((m) => {
                      const on = form.attendee_ids.includes(m.user_id!);
                      return (
                        <button
                          key={m.user_id}
                          type="button"
                          onClick={() => toggleAttendee(m.user_id!)}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                            on
                              ? "border-primary/40 bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {m.full_name}
                        </button>
                      );
                    })}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  לעסק הזה עדיין אין אנשי קשר להצגה.
                </p>
              )}
            </div>
          )}

          {form.org_id && (
            <div className="space-y-1.5">
              <Label htmlFor="d-project">פרויקט</Label>
              <SelectMenu
                id="d-project"
                variant="field"
                ariaLabel="פרויקט"
                placeholder="ללא"
                value={form.project_id}
                onChange={(v) => setForm((f) => ({ ...f, project_id: v }))}
                options={[
                  { value: "", label: "ללא פרויקט" },
                  ...(projects ?? [])
                    .filter((p) => p.org_id === form.org_id)
                    .map((p) => ({ value: p.id, label: p.title })),
                ]}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={saving}>
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
