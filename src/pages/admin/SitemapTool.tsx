import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Lightbulb,
  Loader2,
  Network,
  PenLine,
  Plus,
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
import { generateSitemap, sitemapAssist, type JourneyPersonaHint } from "@/lib/deliverables";
import type {
  JourneyContent,
  PersonaContent,
  SitemapContent,
  SitemapPage,
  ProjectDeliverable,
} from "@/types/database";

export default function SitemapTool() {
  const qc = useQueryClient();
  const { data: projects } = useProjects();
  const { data: businesses } = useBusinesses();
  const [orgId, setOrgId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [generating, setGenerating] = useState(false);

  const { data: disc, isLoading: discLoading } = useProjectDiscoveryItems(projectId || null);
  const { data: deliverables } = useProjectDeliverables(projectId || null);
  const sitemap = (deliverables ?? []).find((d) => d.kind === "sitemap") ?? null;
  const personaCount = (deliverables ?? []).filter((d) => d.kind === "persona").length;
  const hasJourney = (deliverables ?? []).some((d) => d.kind === "journey");

  // Persona + journey context, shared by full generation and the per-page AI helpers.
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
      return toastError("אין שיחת אפיון משויכת לפרויקט הזה. שייך שיחה בעמוד שיחות האפיון קודם.");
    }
    setGenerating(true);
    const r = await generateSitemap({
      title: disc.title,
      items: disc.items,
      personas: personaHints,
      journey,
    });
    if (!r.ok || !r.sitemap) {
      setGenerating(false);
      return toastError(r.error || "יצירת מפת האתר נכשלה.");
    }
    const project = projects?.find((p) => p.id === projectId);
    const row = {
      project_id: projectId,
      org_id: project?.org_id ?? null,
      kind: "sitemap" as const,
      title: r.sitemap.title || "מפת האתר",
      content: r.sitemap as unknown as Record<string, unknown>,
      status: "draft" as const,
    };
    const q = sitemap
      ? supabase.from("project_deliverables").update(row).eq("id", sitemap.id)
      : supabase.from("project_deliverables").insert(row);
    const { error } = await q;
    setGenerating(false);
    if (error) return toastError("שמירת מפת האתר נכשלה.");
    toast({ title: "מפת האתר נוצרה. אפשר לערוך ולפרסם.", variant: "success" });
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
          title="מחולל מפת אתר"
          subtitle="בחר פרויקט, וה-AI ייצר מפת אתר מהאפיון, הפרסונות ומסע הלקוח. ערוך, ואז הצג ללקוח."
        />
      </div>

      <Card className="space-y-3 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="sm-org">עסק</Label>
          <SelectMenu
            id="sm-org"
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
            <Label htmlFor="sm-project">פרויקט</Label>
            <SelectMenu
              id="sm-project"
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
              {generating ? "בונה מפה…" : sitemap ? "צור מחדש (AI)" : "צור מפת אתר (AI)"}
            </Button>
          </div>
        )}
        {projectId && (
          <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {`המפה תתבסס על שיחת האפיון, ${personaCount} פרסונות${hasJourney ? " ומסע הלקוח" : " (אין עדיין מסע לקוח, מומלץ ליצור אותו קודם)"}.`}
          </p>
        )}
        {projectId && sitemap && (
          <Button asChild variant="secondary" size="sm">
            <Link to="/admin/tools/copy">
              <PenLine className="size-4" /> צור קופי לעמודים
            </Link>
          </Button>
        )}
      </Card>

      {projectId &&
        (sitemap ? (
          <SitemapEditor
            d={sitemap}
            projectId={projectId}
            aiTitle={disc?.title || sitemap.title || "האתר"}
            personas={personaHints}
            journey={journey}
          />
        ) : (
          <EmptyState
            icon={Network}
            title="אין עדיין מפת אתר לפרויקט הזה"
            description="לחץ 'צור מפת אתר' כדי לייצר טיוטה מהאפיון, הפרסונות והמסע."
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

interface PageForm {
  name: string;
  purpose: string;
  sections: string;
  order_rationale: string;
  serves: string;
  children: {
    name: string;
    purpose: string;
    sections: string;
    serves: string;
  }[];
}

function pageToForm(p: SitemapPage): PageForm {
  return {
    name: p.name ?? "",
    purpose: p.purpose ?? "",
    sections: toLines(p.sections),
    order_rationale: p.order_rationale ?? "",
    serves: p.serves ?? "",
    children: (p.children ?? []).map((c) => ({
      name: c.name ?? "",
      purpose: c.purpose ?? "",
      sections: toLines(c.sections),
      serves: c.serves ?? "",
    })),
  };
}

function SitemapEditor({
  d,
  projectId,
  aiTitle,
  personas,
  journey,
}: {
  d: ProjectDeliverable;
  projectId: string;
  aiTitle: string;
  personas: JourneyPersonaHint[];
  journey: JourneyContent | null;
}) {
  const qc = useQueryClient();
  const c = d.content as unknown as SitemapContent;
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(c.title ?? "מפת האתר");
  const [designNotes, setDesignNotes] = useState(c.design_notes ?? "");
  const [pages, setPages] = useState<PageForm[]>((c.pages ?? []).map(pageToForm));

  function patchPage(i: number, patch: Partial<PageForm>) {
    setPages((arr) => arr.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }
  function movePage(i: number, dir: -1 | 1) {
    setPages((arr) => {
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      const next = [...arr];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }
  function removePage(i: number) {
    setPages((arr) => arr.filter((_, idx) => idx !== i));
  }
  function addPage() {
    setPages((arr) => [
      ...arr,
      { name: "", purpose: "", sections: "", order_rationale: "", serves: "", children: [] },
    ]);
  }
  function patchChild(pi: number, ci: number, patch: Partial<PageForm["children"][number]>) {
    setPages((arr) =>
      arr.map((p, idx) =>
        idx === pi ? { ...p, children: p.children.map((c2, j) => (j === ci ? { ...c2, ...patch } : c2)) } : p
      )
    );
  }
  function addChild(pi: number) {
    setPages((arr) =>
      arr.map((p, idx) =>
        idx === pi ? { ...p, children: [...p.children, { name: "", purpose: "", sections: "", serves: "" }] } : p
      )
    );
  }
  function removeChild(pi: number, ci: number) {
    setPages((arr) =>
      arr.map((p, idx) => (idx === pi ? { ...p, children: p.children.filter((_, j) => j !== ci) } : p))
    );
  }

  // Per-page AI helpers: task loading + section suggestions, keyed by page index.
  const [assist, setAssist] = useState<
    Record<number, { loading: null | "sections" | "reorder" | "subpages"; suggestions: string[] }>
  >({});

  async function runAssist(i: number, task: "sections" | "reorder" | "subpages") {
    const p = pages[i];
    if (!p.name.trim()) return toastError("תן שם לעמוד קודם.");
    setAssist((s) => ({ ...s, [i]: { loading: task, suggestions: s[i]?.suggestions ?? [] } }));
    const r = await sitemapAssist({
      task,
      title: aiTitle,
      page: {
        name: p.name.trim(),
        purpose: p.purpose.trim(),
        sections: fromLines(p.sections),
        serves: p.serves.trim(),
      },
      personas,
      journey,
    });
    setAssist((s) => ({ ...s, [i]: { loading: null, suggestions: s[i]?.suggestions ?? [] } }));
    if (!r.ok || !r.result) return toastError(r.error || "ה-AI לא הצליח. נסה שוב.");

    if (task === "sections") {
      const secs = ("sections" in r.result ? r.result.sections : []) ?? [];
      const existing = new Set(fromLines(p.sections));
      const fresh = secs.filter((x) => x && !existing.has(x));
      if (fresh.length === 0) return toast({ title: "אין סקשנים חדשים להציע.", variant: "success" });
      setAssist((s) => ({ ...s, [i]: { loading: null, suggestions: fresh } }));
    } else if (task === "reorder") {
      if ("rationale" in r.result) {
        patchPage(i, {
          sections: toLines(r.result.sections),
          order_rationale: r.result.rationale,
        });
        toast({ title: "הסקשנים סודרו מחדש ✓", variant: "success" });
      }
    } else if ("subpages" in r.result) {
      const add = (r.result.subpages ?? []).map((c) => ({
        name: c.name ?? "",
        purpose: c.purpose ?? "",
        sections: toLines(c.sections),
        serves: c.serves ?? "",
      }));
      if (add.length === 0) return toast({ title: "אין צורך בתת-עמודים לעמוד הזה.", variant: "success" });
      setPages((arr) => arr.map((pg, idx) => (idx === i ? { ...pg, children: [...pg.children, ...add] } : pg)));
      toast({ title: `נוספו ${add.length} תת-עמודים ✓`, variant: "success" });
    }
  }

  function addSuggestedSection(i: number, sec: string) {
    setPages((arr) =>
      arr.map((p, idx) => (idx === i ? { ...p, sections: p.sections ? p.sections + "\n" + sec : sec } : p))
    );
    setAssist((s) => ({
      ...s,
      [i]: { loading: s[i]?.loading ?? null, suggestions: (s[i]?.suggestions ?? []).filter((x) => x !== sec) },
    }));
  }

  function buildContent(): SitemapContent {
    const cleanPages: SitemapPage[] = pages
      .map((p) => ({
        name: p.name.trim(),
        purpose: p.purpose.trim(),
        sections: fromLines(p.sections),
        order_rationale: p.order_rationale.trim(),
        serves: p.serves.trim(),
        children: p.children
          .map((c2) => ({
            name: c2.name.trim(),
            purpose: c2.purpose.trim(),
            sections: fromLines(c2.sections),
            serves: c2.serves.trim(),
            children: [],
          }))
          .filter((c2) => c2.name),
      }))
      .filter((p) => p.name);
    return { title: title.trim() || "מפת האתר", pages: cleanPages, design_notes: designNotes.trim() };
  }

  async function save(nextStatus?: "draft" | "published") {
    const content = buildContent();
    if (content.pages.length === 0) return toastError("צריך לפחות עמוד אחד עם שם.");
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
    if (!window.confirm("למחוק את מפת האתר?")) return;
    const { error } = await supabase.from("project_deliverables").delete().eq("id", d.id);
    if (error) return toastError("המחיקה נכשלה.");
    qc.invalidateQueries({ queryKey: ["deliverables", projectId] });
  }

  const published = d.status === "published";

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-2 p-5">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="sm-title">שם המפה</Label>
          <Input id="sm-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
        </div>
        <Badge variant={published ? "success" : "warning"} className="mt-6">
          {published ? "מוצג ללקוח" : "טיוטה"}
        </Badge>
      </Card>

      {pages.map((p, i) => (
        <Card key={i} className="space-y-3 p-5">
          <div className="flex items-center gap-2">
            <Input
              value={p.name}
              onChange={(e) => patchPage(i, { name: e.target.value })}
              placeholder="שם העמוד"
              maxLength={60}
              className="font-heading font-semibold"
            />
            <div className="flex shrink-0 items-center">
              <Button variant="ghost" size="icon" aria-label="למעלה" onClick={() => movePage(i, -1)} disabled={i === 0}>
                <ChevronUp className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="למטה" onClick={() => movePage(i, 1)} disabled={i === pages.length - 1}>
                <ChevronDown className="size-4" />
              </Button>
              <Button variant="ghost" size="icon" aria-label="מחיקה" className="text-destructive" onClick={() => removePage(i)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>מטרת העמוד</Label>
              <Input value={p.purpose} onChange={(e) => patchPage(i, { purpose: e.target.value })} maxLength={200} />
            </div>
            <div className="space-y-1.5">
              <Label>משרת (שלב במסע / פרסונה)</Label>
              <Input value={p.serves} onChange={(e) => patchPage(i, { serves: e.target.value })} maxLength={120} />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label>סקשנים (שורה לכל אחד)</Label>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => runAssist(i, "sections")}
                  disabled={assist[i]?.loading != null}
                >
                  {assist[i]?.loading === "sections" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Lightbulb className="size-3.5" />
                  )}
                  המלצות סקשנים
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs"
                  onClick={() => runAssist(i, "reorder")}
                  disabled={assist[i]?.loading != null || fromLines(p.sections).length < 2}
                >
                  {assist[i]?.loading === "reorder" ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <ArrowUpDown className="size-3.5" />
                  )}
                  סדר עם AI
                </Button>
              </div>
            </div>
            <Textarea value={p.sections} onChange={(e) => patchPage(i, { sections: e.target.value })} rows={3} />
            {(assist[i]?.suggestions ?? []).length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-dashed border-primary/40 bg-primary/5 p-2">
                <span className="text-xs text-muted-foreground">לחץ להוספה:</span>
                {(assist[i]?.suggestions ?? []).map((sec) => (
                  <button
                    key={sec}
                    type="button"
                    onClick={() => addSuggestedSection(i, sec)}
                    className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-card px-2 py-0.5 text-xs text-foreground transition-colors hover:bg-primary/10"
                  >
                    <Plus className="size-3" /> {sec}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-muted-foreground">
              <ArrowUpDown className="size-3.5" /> למה הסדר הזה
            </Label>
            <Textarea
              value={p.order_rationale}
              onChange={(e) => patchPage(i, { order_rationale: e.target.value })}
              rows={2}
              placeholder="ההיגיון מאחורי סדר הסקשנים בעמוד (מוצג ללקוח). כפתור 'סדר עם AI' ממלא את זה אוטומטית."
              className="bg-muted/30 text-sm"
            />
          </div>

          <div className="space-y-2 rounded-xl border border-dashed border-border bg-background/30 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">תת-עמודים</p>
                <p className="text-[11px] text-muted-foreground/80">
                  עמוד שיושב מתחת לעמוד הזה בתפריט (למשל שירות ספציפי תחת "שירותים").
                </p>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="h-7 gap-1 px-2 text-xs"
                onClick={() => runAssist(i, "subpages")}
                disabled={assist[i]?.loading != null}
              >
                {assist[i]?.loading === "subpages" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Sparkles className="size-3.5" />
                )}
                הצע תת-עמודים (AI)
              </Button>
            </div>
            {p.children.map((c2, ci) => (
              <div key={ci} className="space-y-2 rounded-lg border border-border/70 bg-card/40 p-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={c2.name}
                    onChange={(e) => patchChild(i, ci, { name: e.target.value })}
                    placeholder="שם תת-עמוד"
                    maxLength={60}
                    className="h-9"
                  />
                  <Button variant="ghost" size="icon" aria-label="מחיקה" className="size-9 shrink-0 text-destructive" onClick={() => removeChild(i, ci)}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input value={c2.purpose} onChange={(e) => patchChild(i, ci, { purpose: e.target.value })} placeholder="מטרה" maxLength={200} className="h-9" />
                  <Input value={c2.serves} onChange={(e) => patchChild(i, ci, { serves: e.target.value })} placeholder="משרת" maxLength={120} className="h-9" />
                </div>
                <Textarea value={c2.sections} onChange={(e) => patchChild(i, ci, { sections: e.target.value })} placeholder="סקשנים (שורה לכל אחד)" rows={2} />
              </div>
            ))}
            <button
              type="button"
              onClick={() => addChild(i)}
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <Plus className="size-3.5" /> הוסף תת-עמוד
            </button>
          </div>
        </Card>
      ))}

      <button
        type="button"
        onClick={addPage}
        className="flex w-full items-center justify-center gap-1 rounded-xl border border-dashed border-border py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
      >
        <Plus className="size-4" /> הוסף עמוד
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
          <Trash2 className="size-4" /> מחיקת המפה
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
