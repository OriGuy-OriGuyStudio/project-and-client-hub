import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Plus, Trash2, Sparkles, Download, BellPlus, CheckCircle2 } from "lucide-react";
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

export default function Announcements() {
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

  // Which features already have an announcement (active or draft).
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
      />

      <AnnouncementsSection
        announcements={announcements}
        isLoading={anncLoading}
        features={features ?? []}
      />
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
}: {
  features?: SiteFeature[];
  isLoading: boolean;
  announcedFeatureIds: Set<string>;
}) {
  const qc = useQueryClient();
  const [importing, setImporting] = useState(false);

  async function add() {
    const nextOrder = (features?.reduce((m, f) => Math.max(m, f.sort_order), -1) ?? -1) + 1;
    const { error } = await supabase
      .from("site_features")
      .insert({ title: "פיצ'ר חדש", area: "general", is_new: true, sort_order: nextOrder });
    if (error) return toastError("הוספת הפיצ'ר נכשלה.");
    qc.invalidateQueries({ queryKey: ["admin-features"] });
  }

  // "Combination": seed the registry from the existing help/onboarding content,
  // then Ori adds anything that isn't documented there. Skips titles already in.
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
        hint="רשימת הפיצ'רים, מה חדש, והאם בוצעה עליו הכרזה. אפשר לייבא את מה שכבר מתועד בעזרה ולהוסיף ידנית את השאר."
        action={
          <div className="flex shrink-0 items-center gap-2">
            <Button size="sm" variant="ghost" onClick={importFromHelp} disabled={importing}>
              <Download className="size-4" /> {importing ? "מייבא…" : "ייבא מהעזרה"}
            </Button>
            <Button size="sm" variant="secondary" onClick={add}>
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
        <div className="space-y-3">
          {features.map((f) => (
            <FeatureEditor
              key={f.id}
              feature={f}
              announced={announcedFeatureIds.has(f.id)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function FeatureEditor({ feature, announced }: { feature: SiteFeature; announced: boolean }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: feature.title,
    description: feature.description ?? "",
    area: feature.area,
    is_new: feature.is_new,
  });

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    const title = clampText(form.title.trim(), 120);
    if (!title) return toastError("תן שם לפיצ'ר.");
    setSaving(true);
    const { error } = await supabase
      .from("site_features")
      .update({
        title,
        description: clampText(form.description.trim(), 600) || null,
        area: form.area,
        is_new: form.is_new,
        updated_at: new Date().toISOString(),
      })
      .eq("id", feature.id);
    setSaving(false);
    if (error) return toastError("שמירת הפיצ'ר נכשלה.");
    toast({ title: "הפיצ'ר נשמר", variant: "success" });
    qc.invalidateQueries({ queryKey: ["admin-features"] });
  }

  async function remove() {
    if (!window.confirm(`למחוק את הפיצ'ר "${feature.title}"?`)) return;
    const { error } = await supabase.from("site_features").delete().eq("id", feature.id);
    if (error) return toastError("המחיקה נכשלה.");
    qc.invalidateQueries({ queryKey: ["admin-features"] });
  }

  // Create a draft announcement linked to this feature, ready to edit/activate below.
  async function announce() {
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
    toast({ title: "נוצרה טיוטת הכרזה. ערוך והפעל אותה למטה.", variant: "success" });
    qc.invalidateQueries({ queryKey: ["admin-announcements"] });
  }

  return (
    <div className="rounded-xl border border-border bg-background/30 p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
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
      </div>

      <div className="mt-3 space-y-1.5">
        <Label>תיאור</Label>
        <Textarea
          value={form.description}
          maxLength={600}
          rows={2}
          onChange={(e) => update("description", e.target.value)}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.is_new}
              onChange={(e) => update("is_new", e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            חדש
          </label>
          {form.is_new && <Badge>חדש</Badge>}
          <Badge variant="secondary">{AREA_HE[form.area]}</Badge>
          {announced ? (
            <Badge variant="success" className="gap-1">
              <CheckCircle2 className="size-3.5" /> הוכרז
            </Badge>
          ) : (
            <Badge variant="secondary">לא הוכרז</Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!announced && (
            <Button size="sm" variant="secondary" onClick={announce} disabled={creating}>
              <BellPlus className="size-4" /> {creating ? "יוצר…" : "צור הכרזה"}
            </Button>
          )}
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

/* ----------------------------- Announcements ------------------------------ */

function AnnouncementsSection({
  announcements,
  isLoading,
  features,
}: {
  announcements?: Announcement[];
  isLoading: boolean;
  features: SiteFeature[];
}) {
  const qc = useQueryClient();
  const { user } = useAuth();

  async function add() {
    const { error } = await supabase.from("announcements").insert({
      title: "הכרזה חדשה",
      badge: "✨ חדש",
      audience: "both",
      is_active: false,
      created_by: user?.id ?? null,
    });
    if (error) return toastError("הוספת ההכרזה נכשלה.");
    qc.invalidateQueries({ queryKey: ["admin-announcements"] });
  }

  return (
    <Card className="p-5">
      <SectionHeader
        icon={Megaphone}
        title="הכרזות"
        hint="באנר שמופיע ללקוחות/שותפים. לחיצה עליו פותחת חלון עם הפירוט. אפשר לקשר הכרזה לפיצ'ר."
        action={
          <Button size="sm" onClick={add}>
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
        <div className="space-y-3">
          {announcements.map((a) => (
            <AnnouncementEditor key={a.id} announcement={a} features={features} />
          ))}
        </div>
      )}
    </Card>
  );
}

function AnnouncementEditor({
  announcement,
  features,
}: {
  announcement: Announcement;
  features: SiteFeature[];
}) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: announcement.title,
    badge: announcement.badge,
    body: announcement.body ?? "",
    audience: announcement.audience,
    link_url: announcement.link_url ?? "",
    link_label: announcement.link_label ?? "",
    is_external: announcement.is_external,
    is_active: announcement.is_active,
    feature_id: announcement.feature_id ?? "",
  });

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    const title = clampText(form.title.trim(), 120);
    if (!title) return toastError("תן כותרת להכרזה.");
    const badge = clampText(form.badge.trim(), 24) || "✨ חדש";
    setSaving(true);
    const { error } = await supabase
      .from("announcements")
      .update({
        title,
        badge,
        body: clampText(form.body.trim(), 2000) || null,
        audience: form.audience,
        link_url: clampText(form.link_url.trim(), 500) || null,
        link_label: clampText(form.link_label.trim(), 60) || null,
        is_external: form.is_external,
        is_active: form.is_active,
        feature_id: form.feature_id || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", announcement.id);
    setSaving(false);
    if (error) return toastError("שמירת ההכרזה נכשלה.");
    toast({ title: "ההכרזה נשמרה", variant: "success" });
    qc.invalidateQueries({ queryKey: ["admin-announcements"] });
  }

  async function remove() {
    if (!window.confirm(`למחוק את ההכרזה "${announcement.title}"?`)) return;
    const { error } = await supabase.from("announcements").delete().eq("id", announcement.id);
    if (error) return toastError("המחיקה נכשלה.");
    toast({ title: "ההכרזה נמחקה", variant: "success" });
    qc.invalidateQueries({ queryKey: ["admin-announcements"] });
  }

  return (
    <div className="rounded-xl border border-border bg-background/30 p-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div className="space-y-1.5">
          <Label>כותרת (הטקסט בבאנר)</Label>
          <Input value={form.title} maxLength={120} onChange={(e) => update("title", e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label>תגית</Label>
          <Input
            value={form.badge}
            maxLength={24}
            placeholder="✨ חדש"
            className="w-28"
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

      <div className="mt-3 space-y-1.5">
        <Label>פירוט (מוצג בחלון בלחיצה על הבאנר)</Label>
        <Textarea
          value={form.body}
          maxLength={2000}
          rows={4}
          placeholder="מה השתנה? כמה משפטים שיסבירו ללקוח."
          onChange={(e) => update("body", e.target.value)}
        />
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
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
      </div>

      <div className="mt-3 space-y-1.5">
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

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => update("is_active", e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            פעיל (מוצג)
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.is_external}
              onChange={(e) => update("is_external", e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            פתיחת הקישור בטאב חדש
          </label>
          <Badge variant="secondary">{AUDIENCE_HE[form.audience]}</Badge>
          {!form.is_active && <Badge variant="secondary">מוסתר</Badge>}
        </div>
        <div className="flex items-center gap-2">
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
