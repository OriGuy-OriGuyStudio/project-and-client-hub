import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  ChevronDown,
  ClipboardList,
  Download,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SelectMenu } from "@/components/ui/select-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabase";
import { getSignedUrl } from "@/lib/files";
import { toast, toastError } from "@/hooks/use-toast";
import { useProjects } from "@/hooks/useProjects";
import { useBusinesses } from "@/hooks/useBusinesses";
import {
  useProjectDeliverables,
  useProjectDiscoveryItems,
  useBriefResponses,
} from "@/hooks/useDeliverables";
import { generateBrief, type JourneyPersonaHint } from "@/lib/deliverables";
import type {
  BriefContent,
  BriefItemKind,
  BriefResponse,
  PersonaContent,
  ProjectDeliverable,
  SitemapContent,
} from "@/types/database";

const KIND_OPTIONS = [
  { value: "text", label: "טקסט" },
  { value: "image", label: "תמונה" },
  { value: "gallery", label: "גלריית תמונות" },
  { value: "file", label: "קובץ" },
];

function uid() {
  return crypto.randomUUID();
}

/** Give every generated item a stable id (kept across edits). */
function withIds(c: BriefContent): BriefContent {
  return {
    title: c.title || "החומרים לאתר",
    pages: (c.pages ?? []).map((p) => ({
      name: p.name ?? "",
      items: (p.items ?? []).map((it) => ({
        id: it.id || uid(),
        label: it.label ?? "",
        help: it.help ?? "",
        kind: (it.kind ?? "text") as BriefItemKind,
        required: !!it.required,
        prefill: it.prefill ?? "",
      })),
    })),
    design_notes: c.design_notes ?? "",
  };
}

export default function BriefTool() {
  const qc = useQueryClient();
  const { data: projects } = useProjects();
  const { data: businesses } = useBusinesses();
  const [orgId, setOrgId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [generating, setGenerating] = useState(false);

  const { data: disc, isLoading: discLoading } = useProjectDiscoveryItems(projectId || null);
  const { data: deliverables } = useProjectDeliverables(projectId || null);
  const sitemapRow = (deliverables ?? []).find((d) => d.kind === "sitemap") ?? null;
  const brief = (deliverables ?? []).find((d) => d.kind === "brief") ?? null;

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
    if (!sitemapRow) return toastError("צריך מפת אתר לפני יצירת בריף. צור מפת אתר קודם.");
    setGenerating(true);
    const r = await generateBrief({
      title: disc.title,
      items: disc.items,
      personas: personaHints,
      sitemap: sitemapRow.content as unknown as SitemapContent,
    });
    if (!r.ok || !r.brief) {
      setGenerating(false);
      return toastError(r.error || "יצירת הבריף נכשלה.");
    }
    const content = withIds(r.brief);
    const project = projects?.find((p) => p.id === projectId);
    const row = {
      project_id: projectId,
      org_id: project?.org_id ?? null,
      kind: "brief" as const,
      title: content.title,
      content: content as unknown as Record<string, unknown>,
      status: "draft" as const,
    };
    const q = brief
      ? supabase.from("project_deliverables").update(row).eq("id", brief.id)
      : supabase.from("project_deliverables").insert(row);
    const { error } = await q;
    setGenerating(false);
    if (error) return toastError("שמירת הבריף נכשלה.");
    toast({ title: "הבריף נוצר. אפשר לערוך ולהציג ללקוח.", variant: "success" });
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
          title="בריף תוכן ותמונות"
          subtitle="בונה ללקוח רשימה של החומרים שצריך לספק לכל עמוד. הלקוח ממלא ומעלה בפורטל, והחומרים נכנסים לקבצים של הפרויקט."
        />
      </div>

      <Card className="space-y-3 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="bf-org">עסק</Label>
          <SelectMenu
            id="bf-org"
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
            <Label htmlFor="bf-project">פרויקט</Label>
            <SelectMenu
              id="bf-project"
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
              {generating ? "בונה בריף…" : brief ? "צור מחדש (AI)" : "צור בריף (AI)"}
            </Button>
          </div>
        )}
        {projectId && sitemapRow && (
          <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {`הבריף יתבסס על שיחת האפיון, ${personaHints.length} פרסונות ומפת האתר, וימלא מראש מה שכבר ידוע מהשיחה.`}
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
        (brief ? (
          <BriefEditor d={brief} projectId={projectId} />
        ) : (
          <EmptyState
            icon={ClipboardList}
            title="אין עדיין בריף לפרויקט הזה"
            description="לחץ 'צור בריף' כדי לייצר רשימת חומרים לאיסוף מהלקוח, נגזרת ממפת האתר."
          />
        ))}
    </div>
  );
}

interface ItemForm {
  id: string;
  label: string;
  help: string;
  kind: BriefItemKind;
  required: boolean;
  prefill: string;
}
interface PageForm {
  name: string;
  items: ItemForm[];
}

function toForm(c: BriefContent): PageForm[] {
  return (c.pages ?? []).map((p) => ({
    name: p.name ?? "",
    items: (p.items ?? []).map((it) => ({
      id: it.id || uid(),
      label: it.label ?? "",
      help: it.help ?? "",
      kind: (it.kind ?? "text") as BriefItemKind,
      required: !!it.required,
      prefill: it.prefill ?? "",
    })),
  }));
}

function BriefEditor({ d, projectId }: { d: ProjectDeliverable; projectId: string }) {
  const qc = useQueryClient();
  const c = d.content as unknown as BriefContent;
  const { data: responses } = useBriefResponses(projectId);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(c.title ?? "החומרים לאתר");
  const [pages, setPages] = useState<PageForm[]>(toForm(c));

  function patchItem(pi: number, ii: number, patch: Partial<ItemForm>) {
    setPages((arr) =>
      arr.map((p, i) =>
        i === pi ? { ...p, items: p.items.map((it, j) => (j === ii ? { ...it, ...patch } : it)) } : p
      )
    );
  }
  function removeItem(pi: number, ii: number) {
    setPages((arr) => arr.map((p, i) => (i === pi ? { ...p, items: p.items.filter((_, j) => j !== ii) } : p)));
  }
  function addItem(pi: number) {
    setPages((arr) =>
      arr.map((p, i) =>
        i === pi
          ? { ...p, items: [...p.items, { id: uid(), label: "", help: "", kind: "text", required: false, prefill: "" }] }
          : p
      )
    );
  }

  function buildContent(): BriefContent {
    return {
      title: title.trim() || "החומרים לאתר",
      pages: pages.map((p) => ({
        name: p.name.trim(),
        items: p.items
          .filter((it) => it.label.trim())
          .map((it) => ({
            id: it.id,
            label: it.label.trim(),
            help: it.help.trim() || undefined,
            kind: it.kind,
            required: it.required,
            prefill: it.prefill.trim() || undefined,
          })),
      })),
      design_notes: (c.design_notes ?? "").trim(),
    };
  }

  async function save(nextStatus?: "draft" | "published") {
    setSaving(true);
    const content = buildContent();
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
    toast({ title: nextStatus === "published" ? "מוצג ללקוח ✓" : "נשמר", variant: "success" });
    qc.invalidateQueries({ queryKey: ["deliverables", projectId] });
  }

  async function remove() {
    if (!window.confirm("למחוק את הבריף?")) return;
    const { error } = await supabase.from("project_deliverables").delete().eq("id", d.id);
    if (error) return toastError("המחיקה נכשלה.");
    qc.invalidateQueries({ queryKey: ["deliverables", projectId] });
  }

  const published = d.status === "published";
  const total = pages.reduce((n, p) => n + p.items.length, 0);
  const doneCount = (responses ?? []).filter((r) => r.done).length;

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-2 p-5">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="bf-title">שם הבריף</Label>
          <Input id="bf-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} />
        </div>
        <div className="mt-6 flex items-center gap-2">
          {published && total > 0 && (
            <Badge variant="secondary">
              {doneCount}/{total} הושלמו
            </Badge>
          )}
          <Badge variant={published ? "success" : "warning"}>{published ? "מוצג ללקוח" : "טיוטה"}</Badge>
        </div>
      </Card>

      {pages.map((p, pi) => (
        <PageBriefCard
          key={pi}
          page={p}
          responses={responses ?? []}
          onPatch={(ii, patch) => patchItem(pi, ii, patch)}
          onRemove={(ii) => removeItem(pi, ii)}
          onAdd={() => addItem(pi)}
        />
      ))}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" className="text-destructive" onClick={remove}>
          <Trash2 className="size-4" /> מחיקת הבריף
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

function PageBriefCard({
  page,
  responses,
  onPatch,
  onRemove,
  onAdd,
}: {
  page: PageForm;
  responses: BriefResponse[];
  onPatch: (ii: number, patch: Partial<ItemForm>) => void;
  onRemove: (ii: number) => void;
  onAdd: () => void;
}) {
  const [open, setOpen] = useState(true);
  const respByItem = useMemo(() => {
    const m = new Map<string, BriefResponse>();
    responses.forEach((r) => m.set(r.item_id, r));
    return m;
  }, [responses]);

  return (
    <Card className="p-5">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full items-center gap-2 text-start">
          <ClipboardList className="size-5 shrink-0 text-primary" />
          <span className="font-heading text-base font-semibold text-foreground">{page.name}</span>
          <span className="text-xs text-muted-foreground">({page.items.length} פריטים)</span>
          <ChevronDown
            className={cn("ms-auto size-4 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-3">
          {page.items.map((it, ii) => (
            <div key={it.id} className="space-y-2 rounded-xl border border-border bg-background/30 p-3">
              <div className="grid gap-2 sm:grid-cols-[1fr,10rem]">
                <Input
                  value={it.label}
                  onChange={(e) => onPatch(ii, { label: e.target.value })}
                  placeholder="שם הפריט"
                  className="h-9"
                />
                <SelectMenu
                  variant="field"
                  ariaLabel="סוג"
                  value={it.kind}
                  onChange={(v) => onPatch(ii, { kind: v as BriefItemKind })}
                  options={KIND_OPTIONS}
                />
              </div>
              <Input
                value={it.help}
                onChange={(e) => onPatch(ii, { help: e.target.value })}
                placeholder="הסבר קצר ללקוח (מה בדיוק לספק)"
                className="h-9"
              />
              {it.kind === "text" && (
                <Input
                  value={it.prefill}
                  onChange={(e) => onPatch(ii, { prefill: e.target.value })}
                  placeholder="מולא מראש מהאפיון (הלקוח יאשר או יתקן), אופציונלי"
                  className="h-9"
                />
              )}
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={it.required}
                    onChange={(e) => onPatch(ii, { required: e.target.checked })}
                    className="size-4 accent-primary"
                  />
                  חובה
                </label>
                <div className="flex items-center gap-2">
                  <ResponseChip resp={respByItem.get(it.id)} />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 text-destructive"
                    onClick={() => onRemove(ii)}
                    aria-label="מחק פריט"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
              <ResponseDetail resp={respByItem.get(it.id)} />
            </div>
          ))}
          <Button type="button" variant="secondary" size="sm" onClick={onAdd}>
            <Plus className="size-4" /> הוסף פריט
          </Button>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function ResponseChip({ resp }: { resp?: BriefResponse }) {
  if (!resp) return <Badge variant="outline">ממתין</Badge>;
  if (resp.done) return <Badge variant="success">הושלם</Badge>;
  const has = (resp.text?.trim().length ?? 0) > 0 || (resp.files?.length ?? 0) > 0;
  return has ? <Badge variant="secondary">בתהליך</Badge> : <Badge variant="outline">ממתין</Badge>;
}

function ResponseDetail({ resp }: { resp?: BriefResponse }) {
  if (!resp) return null;
  const hasText = (resp.text?.trim().length ?? 0) > 0;
  const files = resp.files ?? [];
  if (!hasText && files.length === 0) return null;

  async function open(path: string) {
    const url = await getSignedUrl(path);
    if (url) window.open(url, "_blank", "noopener");
    else toastError("לא ניתן לפתוח את הקובץ.");
  }

  return (
    <div className="space-y-1.5 rounded-lg border border-primary/20 bg-primary/5 p-2 text-sm">
      {hasText && <p className="whitespace-pre-wrap text-foreground">{resp.text}</p>}
      {files.map((f) => (
        <button
          key={f.path}
          type="button"
          onClick={() => open(f.path)}
          className="flex items-center gap-1.5 text-primary hover:underline"
        >
          {f.mime?.startsWith("image/") ? <ImageIcon className="size-3.5" /> : <Download className="size-3.5" />}
          {f.name}
        </button>
      ))}
    </div>
  );
}
