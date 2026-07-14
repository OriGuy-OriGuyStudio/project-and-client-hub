import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ChevronDown,
  Copy,
  FileText,
  Loader2,
  Plus,
  Search,
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
import { generateSeo, type JourneyPersonaHint } from "@/lib/deliverables";
import type {
  PersonaContent,
  ProjectDeliverable,
  SeoContent,
  SitemapContent,
} from "@/types/database";

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast({ title: "הועתק", variant: "success" });
  } catch {
    toastError("ההעתקה נכשלה, סמן והעתק ידנית.");
  }
}

export default function SeoTool() {
  const qc = useQueryClient();
  const { data: projects } = useProjects();
  const { data: businesses } = useBusinesses();
  const [orgId, setOrgId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [generating, setGenerating] = useState(false);

  const { data: disc, isLoading: discLoading } = useProjectDiscoveryItems(projectId || null);
  const { data: deliverables } = useProjectDeliverables(projectId || null);
  const sitemapRow = (deliverables ?? []).find((d) => d.kind === "sitemap") ?? null;
  const seo = (deliverables ?? []).find((d) => d.kind === "seo") ?? null;

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
    if (!disc?.found || !disc.items.length) return toastError("אין שיחת אפיון משויכת לפרויקט הזה.");
    if (!sitemapRow) return toastError("צריך מפת אתר לפני יצירת בסיס SEO. צור מפת אתר קודם.");
    setGenerating(true);
    const r = await generateSeo({
      title: disc.title,
      items: disc.items,
      personas: personaHints,
      sitemap: sitemapRow.content as unknown as SitemapContent,
    });
    if (!r.ok || !r.seo) {
      setGenerating(false);
      return toastError(r.error || "יצירת בסיס ה-SEO נכשלה.");
    }
    const project = projects?.find((p) => p.id === projectId);
    const row = {
      project_id: projectId,
      org_id: project?.org_id ?? null,
      kind: "seo" as const,
      title: r.seo.title || "בסיס SEO ו-AEO",
      content: r.seo as unknown as Record<string, unknown>,
      status: "draft" as const,
    };
    const q = seo
      ? supabase.from("project_deliverables").update(row).eq("id", seo.id)
      : supabase.from("project_deliverables").insert(row);
    const { error } = await q;
    setGenerating(false);
    if (error) return toastError("שמירת בסיס ה-SEO נכשלה.");
    toast({ title: "בסיס ה-SEO נוצר. אפשר לערוך ולהעתיק.", variant: "success" });
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
          title="בסיס SEO ו-AEO"
          subtitle="לכל עמוד: מטא-טייטל, תיאור, H1, מילות מפתח, פסקת תשובה ל-AEO, שאלות נפוצות ו-JSON-LD. כלי פנימי לבנייה, לא מוצג ללקוח."
        />
      </div>

      <Card className="space-y-3 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="seo-org">עסק</Label>
          <SelectMenu
            id="seo-org"
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
            <Label htmlFor="seo-project">פרויקט</Label>
            <SelectMenu
              id="seo-project"
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
                : !sitemapRow
                  ? "אין עדיין מפת אתר, צור מפת אתר קודם."
                  : disc?.found
                    ? `שיחת אפיון נמצאה (${disc.items.length} תשובות).`
                    : "לא נמצאה שיחת אפיון משויכת."}
            </p>
            <Button onClick={generate} disabled={generating || !disc?.found || !sitemapRow}>
              {generating ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
              {generating ? "בונה SEO…" : seo ? "צור מחדש (AI)" : "צור בסיס SEO/AEO (AI)"}
            </Button>
          </div>
        )}
        {projectId && sitemapRow && (
          <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {`הבסיס יתבסס על שיחת האפיון, ${personaHints.length} פרסונות ומפת האתר. מילות המפתח הן הצעות לפי שפת הקהל, לא נתוני נפח.`}
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
        (seo ? (
          <SeoEditor d={seo} projectId={projectId} />
        ) : (
          <EmptyState
            icon={Search}
            title="אין עדיין בסיס SEO לפרויקט הזה"
            description="לחץ 'צור בסיס SEO/AEO' כדי לייצר מטא, מילות מפתח, AEO ו-JSON-LD לכל עמוד."
          />
        ))}
    </div>
  );
}

interface FaqForm {
  q: string;
  a: string;
}
interface PageForm {
  name: string;
  slug: string;
  meta_title: string;
  meta_description: string;
  h1: string;
  keywords: string;
  aeo_answer: string;
  faqs: FaqForm[];
  json_ld: string;
}

function toForm(c: SeoContent): PageForm[] {
  return (c.pages ?? []).map((p) => ({
    name: p.name ?? "",
    slug: p.slug ?? "",
    meta_title: p.meta_title ?? "",
    meta_description: p.meta_description ?? "",
    h1: p.h1 ?? "",
    keywords: (p.keywords ?? []).join(", "),
    aeo_answer: p.aeo_answer ?? "",
    faqs: (p.faqs ?? []).map((f) => ({ q: f.q ?? "", a: f.a ?? "" })),
    json_ld: p.json_ld ?? "",
  }));
}

function SeoEditor({ d, projectId }: { d: ProjectDeliverable; projectId: string }) {
  const qc = useQueryClient();
  const c = d.content as unknown as SeoContent;
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(c.title ?? "בסיס SEO ו-AEO");
  const [businessJsonLd, setBusinessJsonLd] = useState(c.business_json_ld ?? "");
  const [pages, setPages] = useState<PageForm[]>(toForm(c));

  function patchPage(pi: number, patch: Partial<PageForm>) {
    setPages((arr) => arr.map((p, i) => (i === pi ? { ...p, ...patch } : p)));
  }
  function patchFaq(pi: number, fi: number, patch: Partial<FaqForm>) {
    setPages((arr) =>
      arr.map((p, i) =>
        i === pi ? { ...p, faqs: p.faqs.map((f, j) => (j === fi ? { ...f, ...patch } : f)) } : p
      )
    );
  }
  function addFaq(pi: number) {
    setPages((arr) => arr.map((p, i) => (i === pi ? { ...p, faqs: [...p.faqs, { q: "", a: "" }] } : p)));
  }
  function removeFaq(pi: number, fi: number) {
    setPages((arr) => arr.map((p, i) => (i === pi ? { ...p, faqs: p.faqs.filter((_, j) => j !== fi) } : p)));
  }

  function buildContent(): SeoContent {
    return {
      title: title.trim() || "בסיס SEO ו-AEO",
      business_json_ld: businessJsonLd.trim(),
      pages: pages.map((p) => ({
        name: p.name.trim(),
        slug: p.slug.trim(),
        meta_title: p.meta_title.trim(),
        meta_description: p.meta_description.trim(),
        h1: p.h1.trim(),
        keywords: p.keywords
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean),
        aeo_answer: p.aeo_answer.trim(),
        faqs: p.faqs.filter((f) => f.q.trim()).map((f) => ({ q: f.q.trim(), a: f.a.trim() })),
        json_ld: p.json_ld.trim(),
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
    if (!window.confirm("למחוק את בסיס ה-SEO?")) return;
    const { error } = await supabase.from("project_deliverables").delete().eq("id", d.id);
    if (error) return toastError("המחיקה נכשלה.");
    qc.invalidateQueries({ queryKey: ["deliverables", projectId] });
  }

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-5">
        <div className="space-y-1.5">
          <Label htmlFor="seo-title">שם</Label>
          <Input id="seo-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="seo-biz-ld">JSON-LD של העסק (רמת האתר)</Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => copyText(businessJsonLd)}
              disabled={!businessJsonLd.trim()}
            >
              <Copy className="size-3.5" /> העתק
            </Button>
          </div>
          <Textarea
            id="seo-biz-ld"
            value={businessJsonLd}
            onChange={(e) => setBusinessJsonLd(e.target.value)}
            rows={4}
            className="font-mono text-xs"
          />
        </div>
      </Card>

      {pages.map((p, pi) => (
        <PageSeoCard
          key={pi}
          page={p}
          onPatch={(patch) => patchPage(pi, patch)}
          onPatchFaq={(fi, patch) => patchFaq(pi, fi, patch)}
          onAddFaq={() => addFaq(pi)}
          onRemoveFaq={(fi) => removeFaq(pi, fi)}
        />
      ))}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" className="text-destructive" onClick={remove}>
          <Trash2 className="size-4" /> מחיקת בסיס ה-SEO
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? "שומר…" : "שמירה"}
        </Button>
      </div>
    </div>
  );
}

function CopyField({
  label,
  value,
  onChange,
  max,
  rows,
  mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  max?: number;
  rows?: number;
  mono?: boolean;
}) {
  const over = max != null && value.length > max;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <div className="flex items-center gap-2">
          {max != null && (
            <span className={cn("text-xs", over ? "text-destructive" : "text-muted-foreground")}>
              {value.length}/{max}
            </span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-1.5 text-xs"
            onClick={() => copyText(value)}
            disabled={!value.trim()}
          >
            <Copy className="size-3" /> העתק
          </Button>
        </div>
      </div>
      {rows ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          className={mono ? "font-mono text-xs" : undefined}
        />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-9" />
      )}
    </div>
  );
}

function PageSeoCard({
  page,
  onPatch,
  onPatchFaq,
  onAddFaq,
  onRemoveFaq,
}: {
  page: PageForm;
  onPatch: (patch: Partial<PageForm>) => void;
  onPatchFaq: (fi: number, patch: Partial<FaqForm>) => void;
  onAddFaq: () => void;
  onRemoveFaq: (fi: number) => void;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Card className="p-5">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full items-center gap-2 text-start">
          <Search className="size-5 shrink-0 text-primary" />
          <span className="font-heading text-base font-semibold text-foreground">{page.name}</span>
          <ChevronDown
            className={cn("ms-auto size-4 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <CopyField label="Slug" value={page.slug} onChange={(v) => onPatch({ slug: v })} />
            <CopyField label="H1" value={page.h1} onChange={(v) => onPatch({ h1: v })} />
          </div>
          <CopyField
            label="Meta title"
            value={page.meta_title}
            onChange={(v) => onPatch({ meta_title: v })}
            max={60}
          />
          <CopyField
            label="Meta description"
            value={page.meta_description}
            onChange={(v) => onPatch({ meta_description: v })}
            max={160}
            rows={2}
          />
          <CopyField
            label="מילות מפתח (מופרדות בפסיק)"
            value={page.keywords}
            onChange={(v) => onPatch({ keywords: v })}
          />
          <CopyField
            label="פסקת תשובה (AEO)"
            value={page.aeo_answer}
            onChange={(v) => onPatch({ aeo_answer: v })}
            rows={3}
          />

          <div className="space-y-2 rounded-xl border border-border bg-background/30 p-3">
            <p className="text-sm font-semibold text-foreground">שאלות נפוצות (FAQ)</p>
            {page.faqs.map((f, fi) => (
              <div key={fi} className="space-y-1.5 border-t border-border pt-2 first:border-0 first:pt-0">
                <div className="flex items-center gap-2">
                  <Input
                    value={f.q}
                    onChange={(e) => onPatchFaq(fi, { q: e.target.value })}
                    placeholder="שאלה"
                    className="h-9"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 shrink-0 text-destructive"
                    onClick={() => onRemoveFaq(fi)}
                    aria-label="מחק שאלה"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
                <Textarea
                  value={f.a}
                  onChange={(e) => onPatchFaq(fi, { a: e.target.value })}
                  placeholder="תשובה"
                  rows={2}
                />
              </div>
            ))}
            <Button type="button" variant="secondary" size="sm" onClick={onAddFaq}>
              <Plus className="size-4" /> הוסף שאלה
            </Button>
          </div>

          <CopyField
            label="JSON-LD (עמוד)"
            value={page.json_ld}
            onChange={(v) => onPatch({ json_ld: v })}
            rows={4}
            mono
          />
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
