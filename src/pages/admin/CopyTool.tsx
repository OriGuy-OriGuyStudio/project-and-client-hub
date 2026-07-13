import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ChevronDown,
  Copy,
  FileText,
  Loader2,
  PenLine,
  Sparkles,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectMenu } from "@/components/ui/select-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { toast, toastError } from "@/hooks/use-toast";
import { useProjects } from "@/hooks/useProjects";
import { useBusinesses } from "@/hooks/useBusinesses";
import { useProjectDeliverables, useProjectDiscoveryItems } from "@/hooks/useDeliverables";
import {
  generateCopy,
  type CopyTone,
  type CopyVoice,
  type JourneyPersonaHint,
} from "@/lib/deliverables";
import type {
  CopyContent,
  JourneyContent,
  PersonaContent,
  SitemapContent,
  ProjectDeliverable,
} from "@/types/database";

const VOICE_OPTIONS = [
  { value: "first_singular", label: "גוף ראשון יחיד (אני)" },
  { value: "first_plural", label: "גוף ראשון רבים (אנחנו)" },
  { value: "third", label: "גוף שלישי (שם העסק)" },
];
const TONE_OPTIONS = [
  { value: "warm", label: "חם ואישי" },
  { value: "professional", label: "מקצועי ואמין" },
  { value: "energetic", label: "אנרגטי ושיווקי" },
  { value: "calm", label: "רגוע ומרגיע" },
  { value: "luxury", label: "יוקרתי ומעודן" },
];

export default function CopyTool() {
  const qc = useQueryClient();
  const { data: projects } = useProjects();
  const { data: businesses } = useBusinesses();
  const [orgId, setOrgId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [voice, setVoice] = useState<CopyVoice>("first_singular");
  const [tone, setTone] = useState<CopyTone>("warm");
  const [generating, setGenerating] = useState(false);

  const { data: disc, isLoading: discLoading } = useProjectDiscoveryItems(projectId || null);
  const { data: deliverables } = useProjectDeliverables(projectId || null);
  const sitemapRow = (deliverables ?? []).find((d) => d.kind === "sitemap") ?? null;
  const copy = (deliverables ?? []).find((d) => d.kind === "copy") ?? null;

  const personaHints: JourneyPersonaHint[] = useMemo(
    () =>
      (deliverables ?? [])
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
        }),
    [deliverables]
  );
  const journey: JourneyContent | null = useMemo(() => {
    const row = (deliverables ?? []).find((d) => d.kind === "journey");
    return row ? (row.content as unknown as JourneyContent) : null;
  }, [deliverables]);

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
      return toastError("אין שיחת אפיון משויכת לפרויקט הזה.");
    }
    if (!sitemapRow) {
      return toastError("צריך מפת אתר לפני יצירת פרומפטים. צור מפת אתר קודם.");
    }
    setGenerating(true);
    const r = await generateCopy({
      title: disc.title,
      items: disc.items,
      personas: personaHints,
      journey,
      sitemap: sitemapRow.content as unknown as SitemapContent,
      voice,
      tone,
    });
    if (!r.ok || !r.copy) {
      setGenerating(false);
      return toastError(r.error || "יצירת הפרומפטים נכשלה.");
    }
    const project = projects?.find((p) => p.id === projectId);
    const row = {
      project_id: projectId,
      org_id: project?.org_id ?? null,
      kind: "copy" as const,
      title: r.copy.title || "פרומפטים לאתר",
      content: r.copy as unknown as Record<string, unknown>,
      status: "draft" as const,
    };
    const q = copy
      ? supabase.from("project_deliverables").update(row).eq("id", copy.id)
      : supabase.from("project_deliverables").insert(row);
    const { error } = await q;
    setGenerating(false);
    if (error) return toastError("שמירת הפרומפטים נכשלה.");
    toast({ title: "הפרומפטים נוצרו. אפשר לערוך ולהעתיק.", variant: "success" });
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
          title="מחולל פרומפטים לתוכן"
          subtitle="לכל עמוד וסקשן במפת האתר, פרומפט מפורט שאתה מזין ל-AI כדי לייצר את התוכן. כלי פנימי, לא מוצג ללקוח."
        />
      </div>

      <Card className="space-y-3 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="cp-org">עסק</Label>
          <SelectMenu
            id="cp-org"
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
            <Label htmlFor="cp-project">פרויקט</Label>
            <SelectMenu
              id="cp-project"
              variant="field"
              ariaLabel="פרויקט"
              value={projectId}
              onChange={(v) => setProjectId(v)}
              options={projectOptions}
            />
          </div>
        )}
        {projectId && sitemapRow && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="cp-voice">גוף הכתיבה</Label>
              <SelectMenu
                id="cp-voice"
                variant="field"
                ariaLabel="גוף הכתיבה"
                value={voice}
                onChange={(v) => setVoice(v as CopyVoice)}
                options={VOICE_OPTIONS}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-tone">טון הכתיבה</Label>
              <SelectMenu
                id="cp-tone"
                variant="field"
                ariaLabel="טון הכתיבה"
                value={tone}
                onChange={(v) => setTone(v as CopyTone)}
                options={TONE_OPTIONS}
              />
            </div>
          </div>
        )}
        {projectId && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {discLoading
                ? "בודק שיחת אפיון…"
                : !sitemapRow
                  ? "אין עדיין מפת אתר, צור מפת אתר קודם."
                  : disc?.found
                    ? `שיחת אפיון נמצאה (${disc.items.length} תשובות).`
                    : "לא נמצאה שיחת אפיון משויכת."}
            </p>
            <Button onClick={generate} disabled={generating || !disc?.found || !sitemapRow}>
              {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {generating ? "כותב פרומפטים…" : copy ? "צור מחדש (AI)" : "צור פרומפטים (AI)"}
            </Button>
          </div>
        )}
        {projectId && sitemapRow && (
          <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {`הפרומפטים יתבססו על שיחת האפיון, ${personaHints.length} פרסונות${journey ? ", מסע הלקוח" : ""} ומפת האתר, ויונחו ב${VOICE_OPTIONS.find((o) => o.value === voice)?.label} בטון ${TONE_OPTIONS.find((o) => o.value === tone)?.label}.`}
          </p>
        )}
        {projectId && !sitemapRow && (
          <Button asChild variant="secondary" size="sm">
            <Link to="/admin/tools/sitemap">
              <FileText className="size-4" /> למחולל מפת האתר
            </Link>
          </Button>
        )}
      </Card>

      {projectId &&
        (copy ? (
          <PromptsEditor d={copy} projectId={projectId} />
        ) : (
          <EmptyState
            icon={PenLine}
            title="אין עדיין פרומפטים לפרויקט הזה"
            description="לחץ 'צור פרומפטים' כדי לייצר פרומפט מותאם לכל סקשן, מהאפיון, הפרסונות, המסע ומפת האתר."
          />
        ))}
    </div>
  );
}

interface SectionForm {
  name: string;
  prompt: string;
}
interface PageForm {
  name: string;
  sections: SectionForm[];
}

function toForm(c: CopyContent): PageForm[] {
  return (c.pages ?? []).map((p) => ({
    name: p.name ?? "",
    sections: (p.sections ?? []).map((s) => ({
      name: s.name ?? "",
      prompt: s.prompt ?? "",
    })),
  }));
}

function PromptsEditor({ d, projectId }: { d: ProjectDeliverable; projectId: string }) {
  const qc = useQueryClient();
  const c = d.content as unknown as CopyContent;
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(c.title ?? "פרומפטים לאתר");
  const [pages, setPages] = useState<PageForm[]>(toForm(c));

  function patchSection(pi: number, si: number, patch: Partial<SectionForm>) {
    setPages((arr) =>
      arr.map((p, i) =>
        i === pi ? { ...p, sections: p.sections.map((s, j) => (j === si ? { ...s, ...patch } : s)) } : p
      )
    );
  }

  function buildContent(): CopyContent {
    return {
      title: title.trim() || "פרומפטים לאתר",
      pages: pages.map((p) => ({
        name: p.name.trim(),
        sections: p.sections.map((s) => ({
          name: s.name.trim(),
          prompt: s.prompt.trim() || undefined,
        })),
      })),
      design_notes: (c.design_notes ?? "").trim(),
    };
  }

  async function save() {
    setSaving(true);
    const content = buildContent();
    const { error } = await supabase
      .from("project_deliverables")
      .update({
        content: content as unknown as Record<string, unknown>,
        title: content.title,
        updated_at: new Date().toISOString(),
      })
      .eq("id", d.id);
    setSaving(false);
    if (error) return toastError("השמירה נכשלה.");
    toast({ title: "נשמר", variant: "success" });
    qc.invalidateQueries({ queryKey: ["deliverables", projectId] });
  }

  async function remove() {
    if (!window.confirm("למחוק את הפרומפטים?")) return;
    const { error } = await supabase.from("project_deliverables").delete().eq("id", d.id);
    if (error) return toastError("המחיקה נכשלה.");
    qc.invalidateQueries({ queryKey: ["deliverables", projectId] });
  }

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center gap-2 p-5">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="cp-title">שם</Label>
          <Input id="cp-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
        </div>
      </Card>

      {pages.map((p, pi) => (
        <PagePromptsCard key={pi} page={p} onPatch={(si, patch) => patchSection(pi, si, patch)} />
      ))}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" className="text-destructive" onClick={remove}>
          <Trash2 className="size-4" /> מחיקת הפרומפטים
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? "שומר…" : "שמירה"}
        </Button>
      </div>
    </div>
  );
}

function PagePromptsCard({
  page,
  onPatch,
}: {
  page: PageForm;
  onPatch: (si: number, patch: Partial<SectionForm>) => void;
}) {
  const [open, setOpen] = useState(true);

  async function copyPrompt(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "הפרומפט הועתק", variant: "success" });
    } catch {
      toastError("ההעתקה נכשלה, סמן והעתק ידנית.");
    }
  }

  return (
    <Card className="p-5">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full items-center gap-2 text-start">
          <FileText className="size-5 shrink-0 text-primary" />
          <span className="font-heading text-base font-semibold text-foreground">{page.name}</span>
          <span className="text-xs text-muted-foreground">({page.sections.length} סקשנים)</span>
          <ChevronDown
            className={cn("ms-auto size-4 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-3">
          {page.sections.map((s, si) => (
            <div key={si} className="space-y-2 rounded-xl border border-border bg-background/30 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-foreground">{s.name}</p>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => copyPrompt(s.prompt)}
                  disabled={!s.prompt.trim()}
                >
                  <Copy className="size-3.5" /> העתק
                </Button>
              </div>
              <Textarea
                value={s.prompt}
                onChange={(e) => onPatch(si, { prompt: e.target.value })}
                placeholder="פרומפט לסקשן"
                rows={5}
              />
            </div>
          ))}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
