import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SelectMenu } from "@/components/ui/select-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { supabase } from "@/lib/supabase";
import { toast, toastError } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useProjects } from "@/hooks/useProjects";
import { useBusinesses } from "@/hooks/useBusinesses";
import { useProjectDeliverables, useProjectDiscoveryItems } from "@/hooks/useDeliverables";
import { generatePersonas, generatePersonaSingle, generatePersonaImage } from "@/lib/deliverables";
import type { PersonaContent, ProjectDeliverable } from "@/types/database";

export default function PersonaTool() {
  const qc = useQueryClient();
  const { data: projects } = useProjects();
  const { data: businesses } = useBusinesses();
  const [orgId, setOrgId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [manualDesc, setManualDesc] = useState("");
  const [manualBusy, setManualBusy] = useState(false);

  const { data: disc, isLoading: discLoading } = useProjectDiscoveryItems(projectId || null);
  const { data: deliverables } = useProjectDeliverables(projectId || null);
  const personas = (deliverables ?? []).filter((d) => d.kind === "persona");

  const orgOptions = useMemo(
    () => [
      { value: "", label: "בחר עסק…" },
      ...(businesses ?? []).map((b) => ({ value: b.id, label: b.name })),
    ],
    [businesses]
  );
  const projectOptions = useMemo(
    () => [
      { value: "", label: "בחר פרויקט…" },
      ...(projects ?? [])
        .filter((p) => p.org_id === orgId)
        .map((p) => ({ value: p.id, label: p.title || "פרויקט ללא שם" }))
        .sort((a, b) => a.label.localeCompare(b.label, "he")),
    ],
    [projects, orgId]
  );

  async function generate() {
    if (!disc?.found || !disc.items.length) {
      return toastError("אין שיחת אפיון משויכת לפרויקט הזה. שייך שיחה בעמוד שיחות האפיון קודם.");
    }
    setGenerating(true);
    const r = await generatePersonas({ title: disc.title, items: disc.items });
    if (!r.ok || !r.personas?.length) {
      setGenerating(false);
      return toastError(r.error || "יצירת הפרסונות נכשלה.");
    }
    const project = projects?.find((p) => p.id === projectId);
    const base = personas.length;
    const rows = r.personas.map((p, i) => ({
      project_id: projectId,
      org_id: project?.org_id ?? null,
      kind: "persona",
      title: p.name,
      content: p as unknown as Record<string, unknown>,
      status: "draft",
      sort_order: base + i,
    }));
    const { data: inserted, error } = await supabase
      .from("project_deliverables")
      .insert(rows)
      .select("id, content");
    setGenerating(false);
    if (error) return toastError("שמירת הפרסונות נכשלה.");
    toast({ title: `נוצרו ${rows.length} פרסונות. מייצר תמונות…`, variant: "success" });
    qc.invalidateQueries({ queryKey: ["deliverables", projectId] });

    // Fill portraits asynchronously so the cards appear immediately.
    for (const row of inserted ?? []) {
      const persona = row.content as unknown as PersonaContent;
      generatePersonaImage(persona, projectId).then(async (url) => {
        if (!url) return;
        await supabase
          .from("project_deliverables")
          .update({ content: { ...persona, avatar_url: url } })
          .eq("id", row.id);
        qc.invalidateQueries({ queryKey: ["deliverables", projectId] });
      });
    }
  }

  /** Adds ONE persona from Ori's own description. Appends with the next
   *  sort_order like `generate` does, so nothing existing is touched , this is
   *  the "add another one" path, callable as many times as he wants, and it
   *  works even for a project with no discovery call. */
  async function addManual() {
    const description = manualDesc.trim();
    if (!description) return toastError("תאר את הפרסונה קודם.");
    setManualBusy(true);
    const project = projects?.find((p) => p.id === projectId);
    const r = await generatePersonaSingle({
      title: disc?.title || project?.title || "",
      description,
      items: disc?.found ? disc.items : [],
      existingNames: personas.map((p) => p.title).filter(Boolean) as string[],
    });
    if (!r.ok || !r.persona) {
      setManualBusy(false);
      return toastError(r.error || "יצירת הפרסונה נכשלה.");
    }
    const { data: inserted, error } = await supabase
      .from("project_deliverables")
      .insert({
        project_id: projectId,
        org_id: project?.org_id ?? null,
        kind: "persona",
        title: r.persona.name,
        content: r.persona as unknown as Record<string, unknown>,
        status: "draft",
        sort_order: personas.length,
      })
      .select("id, content")
      .single();
    setManualBusy(false);
    if (error) return toastError("שמירת הפרסונה נכשלה.");
    setManualDesc("");
    toast({ title: `נוספה הפרסונה ${r.persona.name}. מייצר תמונה…`, variant: "success" });
    qc.invalidateQueries({ queryKey: ["deliverables", projectId] });

    const persona = inserted.content as unknown as PersonaContent;
    generatePersonaImage(persona, projectId).then(async (url) => {
      if (!url) return;
      await supabase
        .from("project_deliverables")
        .update({ content: { ...persona, avatar_url: url } })
        .eq("id", inserted.id);
      qc.invalidateQueries({ queryKey: ["deliverables", projectId] });
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="size-8">
          <Link to="/admin/tools" aria-label="חזרה">
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        <PageHeader
          title="מחולל פרסונה"
          subtitle="בחר פרויקט, וה-AI ייצר פרסונות מתוך שיחת האפיון. ערוך, ואז הצג ללקוח בעמוד הפרויקט."
        />
      </div>

      <Card className="space-y-3 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="pt-org">עסק</Label>
          <SelectMenu
            id="pt-org"
            variant="field"
            ariaLabel="עסק"
            value={orgId}
            onChange={(v) => {
              setOrgId(v);
              setProjectId("");
            }}
            options={orgOptions}
          />
        </div>
        {orgId && (
          <div className="space-y-1.5">
            <Label htmlFor="pt-project">פרויקט</Label>
            <SelectMenu
              id="pt-project"
              variant="field"
              ariaLabel="פרויקט"
              value={projectId}
              onChange={(v) => setProjectId(v)}
              options={projectOptions}
            />
          </div>
        )}
        {projectId && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {discLoading
                ? "בודק שיחת אפיון…"
                : disc?.found
                  ? `שיחת אפיון נמצאה (${disc.items.length} תשובות).`
                  : "לא נמצאה שיחת אפיון משויכת לפרויקט הזה."}
            </p>
            <Button onClick={generate} disabled={generating || !disc?.found}>
              {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {generating ? "בונה פרסונות…" : "צור פרסונות (AI)"}
            </Button>
          </div>
        )}
        {projectId && disc?.found && (
          <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            הפרסונות ייגזרו משיחת האפיון של הפרויקט.
          </p>
        )}
      </Card>

      {/* Manual path: Ori describes a persona in his own words, the AI fleshes
         it out into the full structure, and it's APPENDED , repeatable, and
         available even without a discovery call. */}
      {projectId && (
        <Card className="space-y-3 p-4">
          <div>
            <p className="text-sm font-semibold text-foreground">הוספת פרסונה ידנית</p>
            <p className="text-xs text-muted-foreground">
              תאר פרסונה במילים שלך, וה-AI יחולל אותה לפרסונה מלאה. נוספת לרשימה בלי לדרוס את הקיימות, ואפשר לחזור על זה כמה
              פעמים שצריך.
            </p>
          </div>
          <Textarea
            value={manualDesc}
            onChange={(e) => setManualDesc(e.target.value)}
            rows={4}
            maxLength={4000}
            disabled={manualBusy}
            placeholder="למשל: בעל עסק קטן בן 45 מהצפון, מגיע מהמלצות, לא סבלן לטפסים ארוכים, רוצה לראות מחיר מיד ומחליט בטלפון."
            autoGrow
          />
          <div className="flex justify-end">
            <Button onClick={addManual} disabled={manualBusy || !manualDesc.trim()}>
              {manualBusy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {manualBusy ? "מחולל פרסונה…" : "הוסף פרסונה"}
            </Button>
          </div>
        </Card>
      )}

      {projectId &&
        (personas.length === 0 ? (
          <EmptyState
            icon={UserRound}
            title="אין עדיין פרסונות לפרויקט הזה"
            description="צור פרסונות משיחת האפיון, או תאר פרסונה בעצמך והוסף אותה ידנית."
          />
        ) : (
          <div className="space-y-4">
            {personas.map((d) => (
              <PersonaEditorCard key={d.id} d={d} projectId={projectId} />
            ))}
          </div>
        ))}
    </div>
  );
}

function toLines(arr: string[] | undefined) {
  return (arr ?? []).join("\n");
}
function fromLines(s: string) {
  return s
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
}

function PersonaEditorCard({ d, projectId }: { d: ProjectDeliverable; projectId: string }) {
  const qc = useQueryClient();
  const c = d.content as unknown as PersonaContent;
  const [saving, setSaving] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(c.avatar_url ?? null);
  const [form, setForm] = useState({
    name: c.name ?? "",
    archetype: c.archetype ?? "",
    gender: (c.gender ?? "male") as "male" | "female",
    summary: c.summary ?? "",
    age: c.age ?? "",
    location: c.location ?? "",
    quote: c.quote ?? "",
    context: c.context ?? "",
    how_we_help: c.how_we_help ?? "",
    design_notes: c.design_notes ?? "",
    traits: toLines(c.traits),
    goals: toLines(c.goals),
    pains: toLines(c.pains),
    motivations: toLines(c.motivations),
  });

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function buildContent(): PersonaContent {
    return {
      name: form.name.trim(),
      archetype: form.archetype.trim(),
      gender: form.gender,
      summary: form.summary.trim(),
      age: form.age.trim(),
      location: form.location.trim(),
      traits: fromLines(form.traits),
      quote: form.quote.trim(),
      goals: fromLines(form.goals),
      pains: fromLines(form.pains),
      motivations: fromLines(form.motivations),
      context: form.context.trim(),
      how_we_help: form.how_we_help.trim(),
      design_notes: form.design_notes.trim(),
      avatar_url: avatar,
    };
  }

  async function save(nextStatus?: "draft" | "published") {
    setSaving(true);
    const content = buildContent();
    const { error } = await supabase
      .from("project_deliverables")
      .update({
        content: content as unknown as Record<string, unknown>,
        title: content.name,
        status: nextStatus ?? d.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", d.id);
    setSaving(false);
    if (error) return toastError("השמירה נכשלה.");
    toast({ title: nextStatus === "published" ? "פורסם ללקוח ✓" : "נשמר", variant: "success" });
    qc.invalidateQueries({ queryKey: ["deliverables", projectId] });
  }

  async function regenImage() {
    setImgBusy(true);
    const url = await generatePersonaImage(buildContent(), projectId);
    setImgBusy(false);
    if (!url) return toastError("יצירת התמונה נכשלה. נסה שוב.");
    setAvatar(url);
    await supabase
      .from("project_deliverables")
      .update({ content: { ...buildContent(), avatar_url: url } })
      .eq("id", d.id);
    qc.invalidateQueries({ queryKey: ["deliverables", projectId] });
    toast({ title: "התמונה עודכנה", variant: "success" });
  }

  async function remove() {
    if (!window.confirm(`למחוק את הפרסונה "${form.name || "ללא שם"}"?`)) return;
    const { error } = await supabase.from("project_deliverables").delete().eq("id", d.id);
    if (error) return toastError("המחיקה נכשלה.");
    qc.invalidateQueries({ queryKey: ["deliverables", projectId] });
  }

  const published = d.status === "published";

  return (
    <Card className="space-y-4 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="size-16 shrink-0 overflow-hidden rounded-full bg-muted">
            {avatar ? (
              <img src={avatar} alt="" className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center text-muted-foreground">
                <UserRound className="size-7" />
              </span>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={regenImage} disabled={imgBusy}>
            {imgBusy ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />}
            {imgBusy ? "מייצר…" : avatar ? "תמונה מחדש" : "צור תמונה"}
          </Button>
        </div>
        <Badge variant={published ? "success" : "warning"}>{published ? "מוצג ללקוח" : "טיוטה"}</Badge>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>שם</Label>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} maxLength={80} />
        </div>
        <div className="space-y-1.5">
          <Label>ארכיטיפ</Label>
          <Input value={form.archetype} onChange={(e) => set("archetype", e.target.value)} maxLength={80} />
        </div>
        <div className="space-y-1.5">
          <Label>מין (לבחירת תמונה)</Label>
          <SelectMenu
            variant="field"
            ariaLabel="מין"
            value={form.gender}
            onChange={(v) => set("gender", v as "male" | "female")}
            options={[
              { value: "male", label: "גבר" },
              { value: "female", label: "אישה" },
            ]}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1.5">
            <Label>גיל</Label>
            <Input value={form.age} onChange={(e) => set("age", e.target.value)} maxLength={40} />
          </div>
          <div className="space-y-1.5">
            <Label>מיקום</Label>
            <Input value={form.location} onChange={(e) => set("location", e.target.value)} maxLength={60} />
          </div>
        </div>
      </div>

      <Field label="תיאור" value={form.summary} onChange={(v) => set("summary", v)} rows={2} />
      <Field label="ציטוט" value={form.quote} onChange={(v) => set("quote", v)} rows={2} />
      <Field label="הקשר שימוש (מכשיר, תדירות)" value={form.context} onChange={(v) => set("context", v)} rows={2} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="תכונות (שורה לכל אחת)" value={form.traits} onChange={(v) => set("traits", v)} rows={3} />
        <Field label="מטרות (שורה לכל אחת)" value={form.goals} onChange={(v) => set("goals", v)} rows={3} />
        <Field label="כאבים (שורה לכל אחד)" value={form.pains} onChange={(v) => set("pains", v)} rows={3} />
        <Field label="מניעים (שורה לכל אחד)" value={form.motivations} onChange={(v) => set("motivations", v)} rows={3} />
      </div>

      <Field label="איך העסק עוזר לפרסונה (מוצג ללקוח)" value={form.how_we_help} onChange={(v) => set("how_we_help", v)} rows={3} />

      <div className="space-y-1.5">
        <Label className="flex items-center gap-2">
          המלצות עיצוב וקופי
          <Badge variant="secondary">פנימי, לא מוצג ללקוח</Badge>
        </Label>
        <Textarea
          value={form.design_notes}
          onChange={(e) => set("design_notes", e.target.value)}
          rows={3}
          className="bg-muted/40"
          autoGrow
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <Button variant="ghost" className="text-destructive" onClick={remove}>
          <Trash2 className="size-4" /> מחיקה
        </Button>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => save()} disabled={saving}>
            {saving ? "שומר…" : "שמירה"}
          </Button>
          {published ? (
            <Button variant="secondary" onClick={() => save("draft")} disabled={saving}>
              <EyeOff className="size-4" /> הסתר מהלקוח
            </Button>
          ) : (
            <Button onClick={() => save("published")} disabled={saving}>
              <Eye className="size-4" /> הצג ללקוח
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  rows,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows: number;
}) {
  return (
    <div className={cn("space-y-1.5")}>
      <Label>{label}</Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} autoGrow />
    </div>
  );
}
