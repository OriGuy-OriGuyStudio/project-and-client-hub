import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  Route as RouteIcon,
  Sparkles,
  Trash2,
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
import { useProjects } from "@/hooks/useProjects";
import { useBusinesses } from "@/hooks/useBusinesses";
import { useProjectDeliverables, useProjectDiscoveryItems } from "@/hooks/useDeliverables";
import { generateJourney } from "@/lib/deliverables";
import type { JourneyContent, JourneyStage, PersonaContent, ProjectDeliverable } from "@/types/database";

export default function JourneyTool() {
  const qc = useQueryClient();
  const { data: projects } = useProjects();
  const { data: businesses } = useBusinesses();
  const [orgId, setOrgId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [generating, setGenerating] = useState(false);

  const { data: disc, isLoading: discLoading } = useProjectDiscoveryItems(projectId || null);
  const { data: deliverables } = useProjectDeliverables(projectId || null);
  const journey = (deliverables ?? []).find((d) => d.kind === "journey") ?? null;

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
    // Ground the journey in the project's personas (they are who walk the journey).
    const personaHints = (deliverables ?? [])
      .filter((d) => d.kind === "persona")
      .map((d) => {
        const pc = d.content as unknown as PersonaContent;
        return {
          name: pc.name ?? "",
          archetype: pc.archetype ?? "",
          summary: pc.summary ?? "",
          goals: pc.goals ?? [],
          pains: pc.pains ?? [],
        };
      });
    const r = await generateJourney({ title: disc.title, items: disc.items, personas: personaHints });
    if (!r.ok || !r.journey) {
      setGenerating(false);
      return toastError(r.error || "יצירת המסע נכשלה.");
    }
    const project = projects?.find((p) => p.id === projectId);
    const row = {
      project_id: projectId,
      org_id: project?.org_id ?? null,
      kind: "journey" as const,
      title: r.journey.title || "מסע הלקוח",
      content: r.journey as unknown as Record<string, unknown>,
      status: "draft" as const,
    };
    // One journey per project: replace the existing one, else insert.
    const q = journey
      ? supabase.from("project_deliverables").update(row).eq("id", journey.id)
      : supabase.from("project_deliverables").insert(row);
    const { error } = await q;
    setGenerating(false);
    if (error) return toastError("שמירת המסע נכשלה.");
    toast({ title: "המסע נוצר. אפשר לערוך ולפרסם.", variant: "success" });
    qc.invalidateQueries({ queryKey: ["deliverables", projectId] });
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
          title="מחולל מסע לקוח"
          subtitle="בחר פרויקט, וה-AI ייצר מפת מסע לקוח מהאפיון. ערוך, ואז הצג ללקוח בעמוד הפרויקט."
        />
      </div>

      <Card className="space-y-3 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="jt-org">עסק</Label>
          <SelectMenu
            id="jt-org"
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
            <Label htmlFor="jt-project">פרויקט</Label>
            <SelectMenu
              id="jt-project"
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
              {generating ? "בונה מסע…" : journey ? "צור מחדש (AI)" : "צור מסע (AI)"}
            </Button>
          </div>
        )}
      </Card>

      {projectId &&
        (journey ? (
          <JourneyEditor d={journey} projectId={projectId} />
        ) : (
          <EmptyState
            icon={RouteIcon}
            title="אין עדיין מסע לקוח לפרויקט הזה"
            description="לחץ 'צור מסע' כדי לייצר טיוטה מתוך שיחת האפיון."
          />
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

interface StageForm {
  name: string;
  goal: string;
  emotion: string;
  touchpoints: string;
  pains: string;
  on_site: string;
  actions: string;
}

function JourneyEditor({ d, projectId }: { d: ProjectDeliverable; projectId: string }) {
  const qc = useQueryClient();
  const c = d.content as unknown as JourneyContent;
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(c.title ?? "מסע הלקוח");
  const [designNotes, setDesignNotes] = useState(c.design_notes ?? "");
  const [stages, setStages] = useState<StageForm[]>(
    (c.stages ?? []).map((s) => ({
      name: s.name ?? "",
      goal: s.goal ?? "",
      emotion: s.emotion ?? "",
      touchpoints: toLines(s.touchpoints),
      pains: toLines(s.pains),
      on_site: s.on_site ?? "",
      actions: toLines(s.actions),
    }))
  );

  function patchStage(i: number, patch: Partial<StageForm>) {
    setStages((arr) => arr.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }
  function move(i: number, dir: -1 | 1) {
    setStages((arr) => {
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      const next = [...arr];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function removeStage(i: number) {
    setStages((arr) => arr.filter((_, idx) => idx !== i));
  }
  function addStage() {
    setStages((arr) => [
      ...arr,
      { name: "", goal: "", emotion: "", touchpoints: "", pains: "", on_site: "", actions: "" },
    ]);
  }

  function buildContent(): JourneyContent {
    const cleanStages: JourneyStage[] = stages
      .map((s) => ({
        name: s.name.trim(),
        goal: s.goal.trim(),
        emotion: s.emotion.trim(),
        touchpoints: fromLines(s.touchpoints),
        pains: fromLines(s.pains),
        on_site: s.on_site.trim(),
        actions: fromLines(s.actions),
      }))
      .filter((s) => s.name);
    return { title: title.trim() || "מסע הלקוח", stages: cleanStages, design_notes: designNotes.trim() };
  }

  async function save(nextStatus?: "draft" | "published") {
    const content = buildContent();
    if (content.stages.length === 0) return toastError("צריך לפחות שלב אחד עם שם.");
    setSaving(true);
    const { error } = await supabase
      .from("project_deliverables")
      .update({
        content: content as unknown as Record<string, unknown>,
        title: content.title,
        status: nextStatus ?? d.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", d.id);
    setSaving(false);
    if (error) return toastError("השמירה נכשלה.");
    toast({ title: nextStatus === "published" ? "פורסם ללקוח ✓" : "נשמר", variant: "success" });
    qc.invalidateQueries({ queryKey: ["deliverables", projectId] });
  }

  async function remove() {
    if (!window.confirm("למחוק את המסע?")) return;
    const { error } = await supabase.from("project_deliverables").delete().eq("id", d.id);
    if (error) return toastError("המחיקה נכשלה.");
    qc.invalidateQueries({ queryKey: ["deliverables", projectId] });
  }

  const published = d.status === "published";

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="jt-title">שם המסע</Label>
            <Input id="jt-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
          </div>
          <Badge variant={published ? "success" : "warning"} className="mt-6">
            {published ? "מוצג ללקוח" : "טיוטה"}
          </Badge>
        </div>
      </Card>

      {stages.map((s, i) => (
        <Card key={i} className="space-y-3 p-5">
          <div className="flex items-center gap-2">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
              {i + 1}
            </span>
            <Input
              value={s.name}
              onChange={(e) => patchStage(i, { name: e.target.value })}
              placeholder="שם השלב"
              maxLength={60}
              className="font-heading font-semibold"
            />
            <div className="flex shrink-0 items-center">
              <Button variant="ghost" size="icon" aria-label="למעלה" onClick={() => move(i, -1)} disabled={i === 0}>
                <ChevronUp className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label="למטה"
                onClick={() => move(i, 1)}
                disabled={i === stages.length - 1}
              >
                <ChevronDown className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="מחיקה" className="text-destructive" onClick={() => removeStage(i)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>רגש</Label>
              <Input value={s.emotion} onChange={(e) => patchStage(i, { emotion: e.target.value })} maxLength={40} />
            </div>
            <div className="space-y-1.5">
              <Label>מטרה בשלב</Label>
              <Input value={s.goal} onChange={(e) => patchStage(i, { goal: e.target.value })} maxLength={160} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>נקודות מגע (שורה לכל אחת)</Label>
              <Textarea value={s.touchpoints} onChange={(e) => patchStage(i, { touchpoints: e.target.value })} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label>כאבים (שורה לכל אחד)</Label>
              <Textarea value={s.pains} onChange={(e) => patchStage(i, { pains: e.target.value })} rows={3} />
            </div>
            <div className="space-y-1.5">
              <Label>מה אנחנו עושים</Label>
              <Textarea value={s.actions} onChange={(e) => patchStage(i, { actions: e.target.value })} rows={3} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>מה קורה באתר בשלב הזה (המסע בתוך האתר)</Label>
            <Textarea value={s.on_site} onChange={(e) => patchStage(i, { on_site: e.target.value })} rows={2} />
          </div>
        </Card>
      ))}

      <button
        type="button"
        onClick={addStage}
        className="flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-border py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
      >
        <Plus className="size-4" /> הוסף שלב
      </button>

      <Card className="space-y-1.5 p-5">
        <Label className="flex items-center gap-2">
          המלצות עיצוב וקופי
          <Badge variant="secondary">פנימי, לא מוצג ללקוח</Badge>
        </Label>
        <Textarea value={designNotes} onChange={(e) => setDesignNotes(e.target.value)} rows={3} className="bg-muted/40" />
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" className="text-destructive" onClick={remove}>
          <Trash2 className="size-4" /> מחיקת המסע
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
    </div>
  );
}
