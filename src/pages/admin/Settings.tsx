import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  GripVertical,
  Library,
  ListChecks,
  Plus,
  ShieldAlert,
  Trash2,
  MailWarning,
  MailPlus,
  Send,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectMenu } from "@/components/ui/select-menu";
import { supabase } from "@/lib/supabase";
import { toast, toastError } from "@/hooks/use-toast";
import { sendTestEmail } from "@/lib/invite";
import { SectionNav } from "@/components/layout/SectionNav";
import { clampText } from "@/lib/sanitize";
import type {
  PartnerResource,
  StageTemplate,
  StageTemplateStage,
  StudioSettings,
} from "@/types/database";

const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL as string | undefined;
const WHATSAPP = import.meta.env.VITE_STUDIO_WHATSAPP as string | undefined;

function useStudioSettings() {
  return useQuery({
    queryKey: ["studio-settings"],
    queryFn: async (): Promise<StudioSettings | null> => {
      const { data, error } = await supabase
        .from("studio_settings")
        .select("*")
        .eq("id", true)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export default function Settings() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="הגדרות"
        subtitle="פרטי הסטודיו, תבניות העבודה וחומרי השותפים - במקום אחד."
      />
      <SectionNav />
      <div data-section className="scroll-mt-20"><StudioDetailsSection /></div>
      <div data-section className="scroll-mt-20"><StageTemplatesSection /></div>
      <div data-section className="scroll-mt-20"><PartnerResourcesSection /></div>
      <div data-section className="scroll-mt-20"><WelcomeEmailSection /></div>
      <div data-section className="scroll-mt-20"><WarrantyEmailSection /></div>
    </div>
  );
}

/* ----------------------------- Studio details ----------------------------- */

function SectionHeader({
  icon: Icon,
  title,
  hint,
}: {
  icon: typeof Building2;
  title: string;
  hint?: string;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2">
        <Icon className="size-5 text-brand-cyan-base" />
        <h2 className="font-heading text-lg font-semibold text-foreground">{title}</h2>
      </div>
      {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

function StudioDetailsSection() {
  const qc = useQueryClient();
  const { data: settings, isLoading } = useStudioSettings();
  const [saving, setSaving] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [form, setForm] = useState({
    studio_name: "",
    tagline: "",
    contact_email: "",
    contact_phone: "",
  });

  if (settings && !seeded) {
    setForm({
      studio_name: settings.studio_name ?? "",
      tagline: settings.tagline ?? "",
      contact_email: settings.contact_email ?? "",
      contact_phone: settings.contact_phone ?? "",
    });
    setSeeded(true);
  }

  async function save() {
    const name = clampText(form.studio_name.trim(), 120);
    if (!name) return toastError("תן שם לסטודיו.");
    setSaving(true);
    const { error } = await supabase
      .from("studio_settings")
      .update({
        studio_name: name,
        tagline: clampText(form.tagline.trim(), 160) || null,
        contact_email: clampText(form.contact_email.trim(), 160) || null,
        contact_phone: clampText(form.contact_phone.trim(), 40) || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    setSaving(false);
    if (error) return toastError("שמירת ההגדרות נכשלה.");
    toast({ title: "ההגדרות נשמרו", variant: "success" });
    qc.invalidateQueries({ queryKey: ["studio-settings"] });
  }

  if (isLoading) return <Skeleton className="h-56 w-full rounded-2xl" />;

  return (
    <Card className="p-5">
      <SectionHeader icon={Building2} title="פרטי הסטודיו" hint="מידע כללי על העסק." />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="s-name">שם הסטודיו</Label>
          <Input
            id="s-name"
            value={form.studio_name}
            maxLength={120}
            onChange={(e) => setForm((f) => ({ ...f, studio_name: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-tag">סלוגן</Label>
          <Input
            id="s-tag"
            value={form.tagline}
            maxLength={160}
            onChange={(e) => setForm((f) => ({ ...f, tagline: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-email">אימייל ליצירת קשר</Label>
          <Input
            id="s-email"
            dir="ltr"
            value={form.contact_email}
            maxLength={160}
            onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-phone">טלפון ליצירת קשר</Label>
          <Input
            id="s-phone"
            dir="ltr"
            value={form.contact_phone}
            maxLength={40}
            onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
          />
        </div>
      </div>

      {/* Env-locked identifiers - read only */}
      <div className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
        <ShieldAlert className="mt-0.5 size-4 shrink-0" />
        <div className="space-y-0.5">
          <p>מזהים נעולים (מוגדרים בסביבת המערכת, לא לעריכה כאן):</p>
          <p dir="ltr" className="font-mono-code">אדמין: {ADMIN_EMAIL || "-"}</p>
          <p dir="ltr" className="font-mono-code">WhatsApp: {WHATSAPP || "-"}</p>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button onClick={save} disabled={saving}>
          {saving ? "שומר…" : "שמירה"}
        </Button>
      </div>
    </Card>
  );
}

/* --------------------------- Stage templates ------------------------------ */

function StageTemplatesSection() {
  const qc = useQueryClient();
  const { data: templates, isLoading } = useQuery({
    queryKey: ["stage-templates"],
    queryFn: async (): Promise<StageTemplate[]> => {
      const { data, error } = await supabase
        .from("stage_templates")
        .select("*")
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function addTemplate() {
    const nextOrder =
      (templates?.reduce((m, t) => Math.max(m, t.order_index), -1) ?? -1) + 1;
    const { error } = await supabase.from("stage_templates").insert({
      name: "טמפלט חדש",
      stages: [{ title: "שלב ראשון", assignee: "admin" }],
      order_index: nextOrder,
    });
    if (error) return toastError("הוספת הטמפלט נכשלה.");
    qc.invalidateQueries({ queryKey: ["stage-templates"] });
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <SectionHeader
          icon={ListChecks}
          title="תבניות שלבים"
          hint='התבניות שמופיעות בכפתור "טמפלט" בציר ההתקדמות של כל פרויקט.'
        />
        <Button size="sm" variant="secondary" onClick={addTemplate}>
          <Plus className="size-4" /> תבנית
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : !templates?.length ? (
        <EmptyState icon={ListChecks} title="אין תבניות" description="הוסף תבנית עבודה ראשונה." />
      ) : (
        <div className="space-y-4">
          {templates.map((t) => (
            <TemplateEditor key={t.id} template={t} />
          ))}
        </div>
      )}
    </Card>
  );
}

function TemplateEditor({ template }: { template: StageTemplate }) {
  const qc = useQueryClient();
  const [name, setName] = useState(template.name);
  const [stages, setStages] = useState<StageTemplateStage[]>(template.stages ?? []);
  const [saving, setSaving] = useState(false);

  function updateStage(i: number, patch: Partial<StageTemplateStage>) {
    setStages((s) => s.map((st, idx) => (idx === i ? { ...st, ...patch } : st)));
  }
  function removeStage(i: number) {
    setStages((s) => s.filter((_, idx) => idx !== i));
  }
  function addStage() {
    setStages((s) => [...s, { title: "", assignee: "admin", tasks: [] }]);
  }
  function updateTask(si: number, ti: number, val: string) {
    setStages((s) =>
      s.map((st, idx) =>
        idx === si
          ? { ...st, tasks: (st.tasks ?? []).map((t, j) => (j === ti ? val : t)) }
          : st
      )
    );
  }
  function addTask(si: number) {
    setStages((s) =>
      s.map((st, idx) => (idx === si ? { ...st, tasks: [...(st.tasks ?? []), ""] } : st))
    );
  }
  function removeTask(si: number, ti: number) {
    setStages((s) =>
      s.map((st, idx) =>
        idx === si ? { ...st, tasks: (st.tasks ?? []).filter((_, j) => j !== ti) } : st
      )
    );
  }

  async function save() {
    const cleanName = clampText(name.trim(), 120);
    if (!cleanName) return toastError("תן שם לתבנית.");
    const cleanStages = stages
      .map((s) => ({
        title: clampText(s.title.trim(), 200),
        assignee: s.assignee,
        tasks: (s.tasks ?? [])
          .map((t) => clampText(t.trim(), 200))
          .filter(Boolean),
      }))
      .filter((s) => s.title);
    if (!cleanStages.length) return toastError("תבנית צריכה לפחות שלב אחד.");
    setSaving(true);
    const { error } = await supabase
      .from("stage_templates")
      .update({ name: cleanName, stages: cleanStages })
      .eq("id", template.id);
    setSaving(false);
    if (error) return toastError("שמירת התבנית נכשלה.");
    toast({ title: "התבנית נשמרה", variant: "success" });
    qc.invalidateQueries({ queryKey: ["stage-templates"] });
  }

  async function remove() {
    if (!window.confirm(`למחוק את התבנית "${template.name}"?`)) return;
    const { error } = await supabase.from("stage_templates").delete().eq("id", template.id);
    if (error) return toastError("מחיקת התבנית נכשלה.");
    qc.invalidateQueries({ queryKey: ["stage-templates"] });
  }

  return (
    <div className="rounded-xl border border-border bg-background/30 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Input
          value={name}
          maxLength={120}
          onChange={(e) => setName(e.target.value)}
          className="font-heading font-semibold"
        />
        <Button
          size="icon"
          variant="ghost"
          className="size-9 shrink-0 text-destructive"
          aria-label="מחיקת תבנית"
          onClick={remove}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="space-y-3">
        {stages.map((s, i) => (
          <div key={i} className="rounded-lg border border-border/70 bg-card/40 p-3">
            <div className="flex items-center gap-2">
              <GripVertical className="size-4 shrink-0 text-muted-foreground/50" />
              <Input
                value={s.title}
                maxLength={200}
                placeholder="שם המקטע (פאזה)"
                onChange={(e) => updateStage(i, { title: e.target.value })}
                className="h-9 font-medium"
              />
              <SelectMenu
                ariaLabel="באחריות"
                className="h-9 shrink-0"
                value={s.assignee}
                onChange={(v) => updateStage(i, { assignee: v })}
                options={[
                  { value: "admin", label: "הסטודיו" },
                  { value: "client", label: "הלקוח" },
                ]}
              />
              <Button
                size="icon"
                variant="ghost"
                className="size-9 shrink-0 text-destructive"
                aria-label="הסרת מקטע"
                onClick={() => removeStage(i)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>

            <ul className="mt-2 space-y-1.5 ps-6">
              {(s.tasks ?? []).map((t, ti) => (
                <li key={ti} className="flex items-center gap-2">
                  <span className="size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                  <Input
                    value={t}
                    maxLength={200}
                    placeholder="תת-משימה"
                    onChange={(e) => updateTask(i, ti, e.target.value)}
                    className="h-8 text-sm"
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    className="size-8 shrink-0 text-destructive"
                    aria-label="הסרת תת-משימה"
                    onClick={() => removeTask(i, ti)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() => addTask(i)}
              className="mt-2 ms-6 flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <Plus className="size-3.5" /> הוסף תת-משימה
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={addStage}
          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <Plus className="size-3.5" /> הוסף שלב
        </button>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? "שומר…" : "שמירת תבנית"}
        </Button>
      </div>
    </div>
  );
}

/* -------------------------- Partner resources ----------------------------- */

const RESOURCE_TYPES: { value: NonNullable<PartnerResource["resource_type"]>; label: string }[] = [
  { value: "text_template", label: "טקסט מוכן" },
  { value: "link", label: "קישור" },
  { value: "file", label: "קובץ (כתובת)" },
];

function PartnerResourcesSection() {
  const qc = useQueryClient();
  const { data: resources, isLoading } = useQuery({
    queryKey: ["admin-partner-resources"],
    queryFn: async (): Promise<PartnerResource[]> => {
      const { data, error } = await supabase
        .from("partner_resources")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function addResource() {
    const nextOrder =
      (resources?.reduce((m, r) => Math.max(m, r.sort_order), -1) ?? -1) + 1;
    const { error } = await supabase.from("partner_resources").insert({
      title: "חומר חדש",
      resource_type: "text_template",
      is_active: true,
      sort_order: nextOrder,
    });
    if (error) return toastError("הוספת החומר נכשלה.");
    qc.invalidateQueries({ queryKey: ["admin-partner-resources"] });
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-start justify-between gap-2">
        <SectionHeader
          icon={Library}
          title="חומרי שותפים"
          hint="מצגות, קישורים וטקסטים שהשותפים רואים בפורטל שלהם."
        />
        <Button size="sm" variant="secondary" onClick={addResource}>
          <Plus className="size-4" /> חומר
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-32 w-full rounded-2xl" />
      ) : !resources?.length ? (
        <EmptyState icon={Library} title="אין עדיין חומרים" description="הוסף חומר מכירה ראשון לשותפים." />
      ) : (
        <div className="space-y-3">
          {resources.map((r) => (
            <ResourceEditor key={r.id} resource={r} />
          ))}
        </div>
      )}
    </Card>
  );
}

function ResourceEditor({ resource }: { resource: PartnerResource }) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: resource.title,
    description: resource.description ?? "",
    resource_type: (resource.resource_type ?? "text_template") as NonNullable<
      PartnerResource["resource_type"]
    >,
    content: resource.content ?? "",
    file_url: resource.file_url ?? "",
    is_active: resource.is_active,
  });

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    const title = clampText(form.title.trim(), 160);
    if (!title) return toastError("תן שם לחומר.");
    setSaving(true);
    const { error } = await supabase
      .from("partner_resources")
      .update({
        title,
        description: clampText(form.description.trim(), 400) || null,
        resource_type: form.resource_type,
        content: clampText(form.content.trim(), 4000) || null,
        file_url: clampText(form.file_url.trim(), 1000) || null,
        is_active: form.is_active,
      })
      .eq("id", resource.id);
    setSaving(false);
    if (error) return toastError("שמירת החומר נכשלה.");
    toast({ title: "החומר נשמר", variant: "success" });
    qc.invalidateQueries({ queryKey: ["admin-partner-resources"] });
  }

  async function remove() {
    if (!window.confirm(`למחוק את "${resource.title}"?`)) return;
    const { error } = await supabase.from("partner_resources").delete().eq("id", resource.id);
    if (error) return toastError("המחיקה נכשלה.");
    qc.invalidateQueries({ queryKey: ["admin-partner-resources"] });
  }

  return (
    <div className="rounded-xl border border-border bg-background/30 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>כותרת</Label>
          <Input value={form.title} maxLength={160} onChange={(e) => update("title", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>סוג</Label>
          <SelectMenu
            variant="field"
            ariaLabel="סוג"
            value={form.resource_type}
            onChange={(v) => update("resource_type", v)}
            options={RESOURCE_TYPES.map((t) => ({ value: t.value, label: t.label }))}
          />
        </div>
      </div>

      <div className="mt-3 space-y-1.5">
        <Label>תיאור</Label>
        <Input value={form.description} maxLength={400} onChange={(e) => update("description", e.target.value)} />
      </div>

      <div className="mt-3 space-y-1.5">
        {form.resource_type === "text_template" ? (
          <>
            <Label>תוכן הטקסט</Label>
            <Textarea
              value={form.content}
              maxLength={4000}
              rows={3}
              onChange={(e) => update("content", e.target.value)}
            />
          </>
        ) : form.resource_type === "link" ? (
          <>
            <Label>כתובת הקישור</Label>
            <Input dir="ltr" value={form.content} maxLength={1000} onChange={(e) => update("content", e.target.value)} />
          </>
        ) : (
          <>
            <Label>כתובת הקובץ</Label>
            <Input dir="ltr" value={form.file_url} maxLength={1000} onChange={(e) => update("file_url", e.target.value)} />
          </>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => update("is_active", e.target.checked)}
            className="size-4 accent-[var(--primary)]"
          />
          פעיל (מוצג לשותפים)
        </label>
        <div className="flex items-center gap-2">
          {!form.is_active && <Badge variant="secondary">מוסתר</Badge>}
          <Button
            size="icon"
            variant="ghost"
            className="size-9 text-destructive"
            aria-label="מחיקה"
            onClick={remove}
          >
            <Trash2 className="size-4" />
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            {saving ? "שומר…" : "שמירה"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/* -------------------------- Email templates ------------------------------- */

/** Sends a preview of the template to the admin's own inbox. */
function TestEmailButton({ template }: { template: "welcome" | "warranty" }) {
  const [testing, setTesting] = useState(false);
  async function send() {
    setTesting(true);
    const r = await sendTestEmail(template);
    setTesting(false);
    if (r.ok) toast({ title: `נשלח מייל בדיקה ל-${r.to ?? "תיבה שלך"} ✓`, variant: "success" });
    else toastError("שליחת מייל הבדיקה נכשלה.");
  }
  return (
    <Button variant="secondary" onClick={send} disabled={testing}>
      <Send className="size-4" />
      {testing ? "שולח…" : "שלח מייל בדיקה אליי"}
    </Button>
  );
}

function WelcomeEmailSection() {
  const qc = useQueryClient();
  const { data: settings, isLoading } = useStudioSettings();
  const [saving, setSaving] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [form, setForm] = useState({ subject: "", body: "", portal: "" });

  if (settings && !seeded) {
    setForm({
      subject: settings.welcome_email_subject ?? "",
      body: settings.welcome_email_body ?? "",
      portal: settings.portal_url ?? "",
    });
    setSeeded(true);
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("studio_settings")
      .update({
        welcome_email_subject: clampText(form.subject.trim(), 200) || null,
        welcome_email_body: clampText(form.body.trim(), 4000) || null,
        portal_url: clampText(form.portal.trim(), 300) || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    setSaving(false);
    if (error) return toastError("שמירת התבנית נכשלה.");
    toast({ title: "מייל הברוכים הבאים נשמר", variant: "success" });
    qc.invalidateQueries({ queryKey: ["studio-settings"] });
  }

  if (isLoading) return <Skeleton className="h-56 w-full rounded-2xl" />;

  return (
    <Card className="p-5">
      <SectionHeader
        icon={MailPlus}
        title="מייל ברוכים הבאים (Orion)"
        hint="נשלח אוטומטית ללקוח/שותף חדש עם קישור כניסה. כפתור 'כניסה ל-Orion' מתווסף אוטומטית."
      />
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="wl-subj">נושא המייל</Label>
          <Input
            id="wl-subj"
            value={form.subject}
            maxLength={200}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wl-body">גוף המייל</Label>
          <Textarea
            id="wl-body"
            value={form.body}
            maxLength={4000}
            rows={7}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            טוקנים אישיים: <code className="font-mono-code text-foreground">{"{שם}"}</code> מוחלף בשם.
            לניסוח לפי מין כתוב <code className="font-mono-code text-foreground">זכר|נקבה</code> (למשל{" "}
            <code className="font-mono-code text-foreground">שמח|שמחה</code>).
          </p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="wl-portal">כתובת הפורטל (לקישור הכניסה)</Label>
          <Input
            id="wl-portal"
            dir="ltr"
            value={form.portal}
            maxLength={300}
            placeholder="https://orion.origuystudio.com"
            onChange={(e) => setForm((f) => ({ ...f, portal: e.target.value }))}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            לקוחות מקבלים קישור ל-<code className="font-mono-code text-foreground">/login</code> ושותפים
            ל-<code className="font-mono-code text-foreground">/partner-portal/login</code>.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-between gap-2">
        <TestEmailButton template="welcome" />
        <Button onClick={save} disabled={saving}>
          {saving ? "שומר…" : "שמירה"}
        </Button>
      </div>
    </Card>
  );
}

/* -------------------------- Warranty email -------------------------------- */

function WarrantyEmailSection() {
  const qc = useQueryClient();
  const { data: settings, isLoading } = useStudioSettings();
  const [saving, setSaving] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [form, setForm] = useState({ subject: "", body: "" });

  if (settings && !seeded) {
    setForm({
      subject: settings.warranty_email_subject ?? "",
      body: settings.warranty_email_body ?? "",
    });
    setSeeded(true);
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("studio_settings")
      .update({
        warranty_email_subject: clampText(form.subject.trim(), 200) || null,
        warranty_email_body: clampText(form.body.trim(), 4000) || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", true);
    setSaving(false);
    if (error) return toastError("שמירת התבנית נכשלה.");
    toast({ title: "תבנית האחריות נשמרה", variant: "success" });
    qc.invalidateQueries({ queryKey: ["studio-settings"] });
  }

  if (isLoading) return <Skeleton className="h-56 w-full rounded-2xl" />;

  return (
    <Card className="p-5">
      <SectionHeader
        icon={MailWarning}
        title="תבנית מייל אחריות"
        hint="הטקסט שיישלח ללקוח כשתקופת האחריות מתקרבת לסיום."
      />
      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="w-subj">נושא המייל</Label>
          <Input
            id="w-subj"
            value={form.subject}
            maxLength={200}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="w-body">גוף המייל</Label>
          <Textarea
            id="w-body"
            value={form.body}
            maxLength={4000}
            rows={6}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
          />
          <p className="text-xs leading-relaxed text-muted-foreground">
            טוקנים אישיים: <code className="font-mono-code text-foreground">{"{שם}"}</code> מוחלף בשם הלקוח.
            לניסוח לפי מין כתוב <code className="font-mono-code text-foreground">זכר|נקבה</code> (למשל{" "}
            <code className="font-mono-code text-foreground">תרצה|תרצי</code>) - המערכת תבחר לפי המין שהוגדר בכרטיס הלקוח.
          </p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-between gap-2">
        <TestEmailButton template="warranty" />
        <Button onClick={save} disabled={saving}>
          {saving ? "שומר…" : "שמירה"}
        </Button>
      </div>
    </Card>
  );
}
