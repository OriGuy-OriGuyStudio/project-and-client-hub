import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Megaphone,
  Plus,
  Trash2,
  Sparkles,
  Download,
  BellPlus,
  CheckCircle2,
  Eye,
  Pencil,
  ExternalLink,
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
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { HeroPill } from "@/components/ui/hero-pill";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { toast, toastError } from "@/hooks/use-toast";
import { clampText } from "@/lib/sanitize";
import { helpSections, partnerHelpSections } from "@/components/help/help-content";
import type {
  Announcement,
  AnnouncementAudience,
  FeatureArea,
  SiteFeature,
} from "@/types/database";

const AUDIENCE_OPTIONS: { value: AnnouncementAudience; label: string }[] = [
  { value: "both", label: "לקוחות ושותפים" },
  { value: "client", label: "לקוחות בלבד" },
  { value: "partner", label: "שותפים בלבד" },
];

const AUDIENCE_HE: Record<AnnouncementAudience, string> = {
  both: "לקוחות ושותפים",
  client: "לקוחות",
  partner: "שותפים",
};

const AREA_OPTIONS: { value: FeatureArea; label: string }[] = [
  { value: "general", label: "כללי" },
  { value: "client", label: "לקוחות" },
  { value: "partner", label: "שותפים" },
  { value: "both", label: "לקוחות ושותפים" },
  { value: "admin", label: "אדמין / פנימי" },
];

const AREA_HE: Record<FeatureArea, string> = {
  general: "כללי",
  client: "לקוחות",
  partner: "שותפים",
  both: "לקוחות ושותפים",
  admin: "אדמין / פנימי",
};

/** Map a feature's area to the audience of an announcement created from it. */
function areaToAudience(area: FeatureArea): AnnouncementAudience {
  if (area === "client" || area === "partner" || area === "both") return area;
  return "both";
}

/** "new" sentinel = open the sheet with an empty form. */
type FeatureSheetState = SiteFeature | "new" | null;
type AnnouncementSheetState = Announcement | "new" | null;

export default function Announcements() {
  const [featureSheet, setFeatureSheet] = useState<FeatureSheetState>(null);
  const [announcementSheet, setAnnouncementSheet] = useState<AnnouncementSheetState>(null);

  const { data: features, isLoading: featuresLoading } = useQuery({
    queryKey: ["admin-features"],
    queryFn: async (): Promise<SiteFeature[]> => {
      const { data, error } = await supabase
        .from("site_features")
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: announcements, isLoading: anncLoading } = useQuery({
    queryKey: ["admin-announcements"],
    queryFn: async (): Promise<Announcement[]> => {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const announcedFeatureIds = new Set(
    (announcements ?? []).map((a) => a.feature_id).filter(Boolean) as string[]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="הכרזות ופיצ'רים"
        subtitle="נהל את הפיצ'רים באתר (חדש / הוכרז), והכרזות הבאנר שמופיעות ללקוחות ושותפים על שינוי או חידוש."
      />

      <FeaturesSection
        features={features}
        isLoading={featuresLoading}
        announcedFeatureIds={announcedFeatureIds}
        onAdd={() => setFeatureSheet("new")}
        onEdit={setFeatureSheet}
      />

      <AnnouncementsSection
        announcements={announcements}
        isLoading={anncLoading}
        onAdd={() => setAnnouncementSheet("new")}
        onEdit={setAnnouncementSheet}
      />

      {/* Add/edit a feature — side sheet */}
      <Sheet open={!!featureSheet} onOpenChange={(o) => !o && setFeatureSheet(null)}>
        <SheetContent>
          {featureSheet && (
            <FeatureForm
              key={featureSheet === "new" ? "new" : featureSheet.id}
              feature={featureSheet === "new" ? null : featureSheet}
              onClose={() => setFeatureSheet(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Add/edit an announcement — side sheet */}
      <Sheet open={!!announcementSheet} onOpenChange={(o) => !o && setAnnouncementSheet(null)}>
        <SheetContent className="max-w-lg">
          {announcementSheet && (
            <AnnouncementForm
              key={announcementSheet === "new" ? "new" : announcementSheet.id}
              announcement={announcementSheet === "new" ? null : announcementSheet}
              features={features ?? []}
              onClose={() => setAnnouncementSheet(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* ----------------------------- Section header ----------------------------- */

function SectionHeader({
  icon: Icon,
  title,
  hint,
  action,
}: {
  icon: typeof Megaphone;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-2">
      <div>
        <div className="flex items-center gap-2">
          <Icon className="size-5 text-brand-cyan-base" />
          <h2 className="font-heading text-lg font-semibold text-foreground">{title}</h2>
        </div>
        {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------- Features --------------------------------- */

function FeaturesSection({
  features,
  isLoading,
  announcedFeatureIds,
  onAdd,
  onEdit,
}: {
  features?: SiteFeature[];
  isLoading: boolean;
  announcedFeatureIds: Set<string>;
  onAdd: () => void;
  onEdit: (f: SiteFeature) => void;
}) {
  const qc = useQueryClient();
  const [importing, setImporting] = useState(false);

  async function importFromHelp() {
    setImporting(true);
    const existing = new Set((features ?? []).map((f) => f.title.trim()));
    const rows = [
      ...helpSections.map((s) => ({ title: s.title, description: s.body, area: "client" as FeatureArea })),
      ...partnerHelpSections.map((s) => ({ title: s.title, description: s.body, area: "partner" as FeatureArea })),
    ].filter((r) => !existing.has(r.title.trim()));

    if (!rows.length) {
      setImporting(false);
      return toast({ title: "הכל כבר מיובא", variant: "success" });
    }
    let order = (features?.reduce((m, f) => Math.max(m, f.sort_order), -1) ?? -1) + 1;
    const { error } = await supabase
      .from("site_features")
      .insert(rows.map((r) => ({ ...r, is_new: false, sort_order: order++ })));
    setImporting(false);
    if (error) return toastError("הייבוא נכשל.");
    toast({ title: `יובאו ${rows.length} פיצ'רים מתוכן העזרה`, variant: "success" });
    qc.invalidateQueries({ queryKey: ["admin-features"] });
  }

  return (
    <Card className="p-5">
      <SectionHeader
        icon={Sparkles}
        title="פיצ'רים באתר"
        hint="רשימת הפיצ'רים, מה חדש, והאם בוצעה עליו הכרזה. לחיצה על פיצ'ר פותחת מגירה לעריכה."
        action={
          <div className="flex shrink-0 items-center gap-2">
            <Button size="sm" variant="ghost" onClick={importFromHelp} disabled={importing}>
              <Download className="size-4" /> {importing ? "מייבא…" : "ייבא מהעזרה"}
            </Button>
            <Button size="sm" variant="secondary" onClick={onAdd}>
              <Plus className="size-4" /> פיצ'ר
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <Skeleton className="h-32 w-full rounded-2xl" />
      ) : !features?.length ? (
        <EmptyState
          icon={Sparkles}
          title="אין עדיין פיצ'רים ברשימה"
          description="ייבא מתוכן העזרה או הוסף פיצ'ר ראשון ידנית."
        />
      ) : (
        <div className="space-y-2">
          {features.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => onEdit(f)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-background/30 p-3 text-start transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Pencil className="size-4 shrink-0 text-muted-foreground" />
                <span className="truncate font-medium text-foreground">{f.title}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                {f.is_new && <Badge>חדש</Badge>}
                <Badge variant="secondary">{AREA_HE[f.area]}</Badge>
                {announcedFeatureIds.has(f.id) ? (
                  <Badge variant="success" className="gap-1">
                    <CheckCircle2 className="size-3.5" /> הוכרז
                  </Badge>
                ) : (
                  <Badge variant="secondary">לא הוכרז</Badge>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

function FeatureForm({ feature, onClose }: { feature: SiteFeature | null; onClose: () => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: feature?.title ?? "",
    description: feature?.description ?? "",
    area: feature?.area ?? ("general" as FeatureArea),
    is_new: feature?.is_new ?? true,
  });

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    const title = clampText(form.title.trim(), 120);
    if (!title) return toastError("תן שם לפיצ'ר.");
    setSaving(true);
    const payload = {
      title,
      description: clampText(form.description.trim(), 600) || null,
      area: form.area,
      is_new: form.is_new,
    };
    const { error } = feature
      ? await supabase
          .from("site_features")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", feature.id)
      : await supabase.from("site_features").insert(payload);
    setSaving(false);
    if (error) return toastError("שמירת הפיצ'ר נכשלה.");
    toast({ title: feature ? "הפיצ'ר נשמר" : "הפיצ'ר נוסף", variant: "success" });
    qc.invalidateQueries({ queryKey: ["admin-features"] });
    onClose();
  }

  async function remove() {
    if (!feature) return;
    if (!window.confirm(`למחוק את הפיצ'ר "${feature.title}"?`)) return;
    const { error } = await supabase.from("site_features").delete().eq("id", feature.id);
    if (error) return toastError("המחיקה נכשלה.");
    qc.invalidateQueries({ queryKey: ["admin-features"] });
    onClose();
  }

  async function announce() {
    if (!feature) return;
    setCreating(true);
    const { error } = await supabase.from("announcements").insert({
      title: clampText(form.title.trim(), 120) || feature.title,
      body: clampText(form.description.trim(), 2000) || null,
      audience: areaToAudience(form.area),
      badge: "✨ חדש",
      is_active: false,
      feature_id: feature.id,
      created_by: user?.id ?? null,
    });
    setCreating(false);
    if (error) return toastError("יצירת ההכרזה נכשלה.");
    toast({ title: "נוצרה טיוטת הכרזה. ערוך והפעל אותה ברשימת ההכרזות.", variant: "success" });
    qc.invalidateQueries({ queryKey: ["admin-announcements"] });
    onClose();
  }

  return (
    <>
      <SheetHeader>
        <SheetTitle>{feature ? "עריכת פיצ'ר" : "פיצ'ר חדש"}</SheetTitle>
      </SheetHeader>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>שם הפיצ'ר</Label>
          <Input value={form.title} maxLength={120} onChange={(e) => update("title", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>אזור</Label>
          <SelectMenu
            variant="field"
            ariaLabel="אזור"
            value={form.area}
            onChange={(v) => update("area", v as FeatureArea)}
            options={AREA_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label>תיאור</Label>
          <Textarea
            value={form.description}
            maxLength={600}
            rows={3}
            onChange={(e) => update("description", e.target.value)}
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.is_new}
            onChange={(e) => update("is_new", e.target.checked)}
            className="size-4 accent-[var(--primary)]"
          />
          מסומן כחדש
        </label>
        {feature && (
          <Button variant="secondary" className="w-full" onClick={announce} disabled={creating}>
            <BellPlus className="size-4" /> {creating ? "יוצר…" : "צור הכרזה מהפיצ'ר הזה"}
          </Button>
        )}
      </div>

      <SheetFooter>
        <Button onClick={save} disabled={saving}>
          {saving ? "שומר…" : "שמירה"}
        </Button>
        {feature && (
          <Button variant="ghost" className="text-destructive" onClick={remove}>
            <Trash2 className="size-4" /> מחיקה
          </Button>
        )}
      </SheetFooter>
    </>
  );
}

/* ----------------------------- Announcements ------------------------------ */

function AnnouncementsSection({
  announcements,
  isLoading,
  onAdd,
  onEdit,
}: {
  announcements?: Announcement[];
  isLoading: boolean;
  onAdd: () => void;
  onEdit: (a: Announcement) => void;
}) {
  return (
    <Card className="p-5">
      <SectionHeader
        icon={Megaphone}
        title="הכרזות"
        hint="באנר שמופיע ללקוחות/שותפים. לחיצה על הכרזה פותחת מגירה לעריכה, עם תצוגה מקדימה."
        action={
          <Button size="sm" onClick={onAdd}>
            <Plus className="size-4" /> הכרזה
          </Button>
        }
      />

      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : !announcements?.length ? (
        <EmptyState
          icon={Megaphone}
          title="אין עדיין הכרזות"
          description="הוסף הכרזה, או צור אחת מתוך פיצ'ר למעלה."
        />
      ) : (
        <div className="space-y-2">
          {announcements.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onEdit(a)}
              className="flex w-full items-center justify-between gap-3 rounded-xl border border-border bg-background/30 p-3 text-start transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <Pencil className="size-4 shrink-0 text-muted-foreground" />
                <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                  {a.badge}
                </span>
                <span className="truncate font-medium text-foreground">{a.title}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Badge variant="secondary">{AUDIENCE_HE[a.audience]}</Badge>
                {a.is_active ? (
                  <Badge variant="success">פעיל</Badge>
                ) : (
                  <Badge variant="secondary">מוסתר</Badge>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </Card>
  );
}

function AnnouncementForm({
  announcement,
  features,
  onClose,
}: {
  announcement: Announcement | null;
  features: SiteFeature[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [form, setForm] = useState({
    title: announcement?.title ?? "",
    badge: announcement?.badge ?? "✨ חדש",
    body: announcement?.body ?? "",
    audience: announcement?.audience ?? ("both" as AnnouncementAudience),
    link_url: announcement?.link_url ?? "",
    link_label: announcement?.link_label ?? "",
    is_external: announcement?.is_external ?? true,
    is_active: announcement?.is_active ?? false,
    feature_id: announcement?.feature_id ?? "",
  });

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    const title = clampText(form.title.trim(), 120);
    if (!title) return toastError("תן כותרת להכרזה.");
    const badge = clampText(form.badge.trim(), 24) || "✨ חדש";
    setSaving(true);
    const payload = {
      title,
      badge,
      body: clampText(form.body.trim(), 2000) || null,
      audience: form.audience,
      link_url: clampText(form.link_url.trim(), 500) || null,
      link_label: clampText(form.link_label.trim(), 60) || null,
      is_external: form.is_external,
      is_active: form.is_active,
      feature_id: form.feature_id || null,
    };
    const { error } = announcement
      ? await supabase
          .from("announcements")
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq("id", announcement.id)
      : await supabase.from("announcements").insert({ ...payload, created_by: user?.id ?? null });
    setSaving(false);
    if (error) return toastError("שמירת ההכרזה נכשלה.");
    toast({ title: announcement ? "ההכרזה נשמרה" : "ההכרזה נוספה", variant: "success" });
    qc.invalidateQueries({ queryKey: ["admin-announcements"] });
    onClose();
  }

  async function remove() {
    if (!announcement) return;
    if (!window.confirm(`למחוק את ההכרזה "${announcement.title}"?`)) return;
    const { error } = await supabase.from("announcements").delete().eq("id", announcement.id);
    if (error) return toastError("המחיקה נכשלה.");
    toast({ title: "ההכרזה נמחקה", variant: "success" });
    qc.invalidateQueries({ queryKey: ["admin-announcements"] });
    onClose();
  }

  const canPreview = form.title.trim().length > 0;

  return (
    <>
      <SheetHeader>
        <SheetTitle>{announcement ? "עריכת הכרזה" : "הכרזה חדשה"}</SheetTitle>
      </SheetHeader>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>כותרת (הטקסט בבאנר)</Label>
          <Input value={form.title} maxLength={120} onChange={(e) => update("title", e.target.value)} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>תגית</Label>
            <Input
              value={form.badge}
              maxLength={24}
              placeholder="✨ חדש"
              onChange={(e) => update("badge", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>קהל יעד</Label>
            <SelectMenu
              variant="field"
              ariaLabel="קהל יעד"
              value={form.audience}
              onChange={(v) => update("audience", v as AnnouncementAudience)}
              options={AUDIENCE_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>פירוט (מוצג בחלון בלחיצה על הבאנר)</Label>
          <Textarea
            value={form.body}
            maxLength={2000}
            rows={4}
            placeholder="מה השתנה? כמה משפטים שיסבירו ללקוח."
            onChange={(e) => update("body", e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label>קישור (אופציונלי)</Label>
          <Input
            dir="ltr"
            value={form.link_url}
            maxLength={500}
            placeholder="https://origuystudio.com"
            onChange={(e) => update("link_url", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>טקסט הכפתור</Label>
          <Input
            value={form.link_label}
            maxLength={60}
            placeholder="למשל: לצפייה בדף הנחיתה החדש"
            onChange={(e) => update("link_label", e.target.value)}
          />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.is_external}
            onChange={(e) => update("is_external", e.target.checked)}
            className="size-4 accent-[var(--primary)]"
          />
          פתיחת הקישור בטאב חדש
        </label>

        <div className="space-y-1.5">
          <Label>פיצ'ר מקושר (אופציונלי)</Label>
          <SelectMenu
            variant="field"
            ariaLabel="פיצ'ר מקושר"
            value={form.feature_id}
            onChange={(v) => update("feature_id", v)}
            options={[
              { value: "", label: "— ללא —" },
              ...features.map((f) => ({ value: f.id, label: f.title })),
            ]}
          />
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => update("is_active", e.target.checked)}
            className="size-4 accent-[var(--primary)]"
          />
          פעיל (מוצג ללקוחות/שותפים)
        </label>

        <Button variant="secondary" className="w-full" onClick={() => setPreviewOpen(true)} disabled={!canPreview}>
          <Eye className="size-4" /> תצוגה מקדימה
        </Button>
      </div>

      <SheetFooter>
        <Button onClick={save} disabled={saving}>
          {saving ? "שומר…" : "שמירה"}
        </Button>
        {announcement && (
          <Button variant="ghost" className="text-destructive" onClick={remove}>
            <Trash2 className="size-4" /> מחיקה
          </Button>
        )}
      </SheetFooter>

      <AnnouncementPreview form={form} open={previewOpen} onClose={() => setPreviewOpen(false)} />
    </>
  );
}

/** Shows BOTH the banner pill and the detail modal, separated by a divider. */
function AnnouncementPreview({
  form,
  open,
  onClose,
}: {
  form: {
    title: string;
    badge: string;
    body: string;
    link_url: string;
    link_label: string;
    is_external: boolean;
  };
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">תצוגה מקדימה</DialogTitle>
        </DialogHeader>

        {/* 1 — how it appears in the banner */}
        <p className="text-xs font-medium text-muted-foreground">כך זה ייראה בבאנר:</p>
        <div className="flex justify-start">
          <HeroPill announcement={form.badge || "✨ חדש"} label={form.title || "כותרת ההכרזה"} onClick={() => {}} />
        </div>

        <div className="my-1 h-px w-full bg-border" />

        {/* 2 — how the detail modal appears on click */}
        <p className="text-xs font-medium text-muted-foreground">וכך ייראה החלון בלחיצה:</p>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="w-fit rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
            {form.badge || "✨ חדש"}
          </div>
          <p className="mt-3 font-heading text-xl font-bold text-foreground">
            {form.title || "כותרת ההכרזה"}
          </p>
          {form.body && (
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
              {form.body}
            </p>
          )}
          {form.link_url && (
            <div className="mt-4 inline-flex w-full items-center justify-center gap-1 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
              {form.link_label || "מעבר"}
              {form.is_external && <ExternalLink className="size-4" />}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
