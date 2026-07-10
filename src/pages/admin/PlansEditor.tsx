import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Save, PackageOpen } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast, toastError } from "@/hooks/use-toast";
import type { ServicePlanContent } from "@/types/database";

type FeatureKey = "features_wp" | "features_custom";

/**
 * Admin editor for package contents. Edits service_plan_content (name, label,
 * price, response/work hours, and the full feature lists per site type). Saving
 * updates the live content the landing + new agreements read. Existing signed
 * agreements keep their frozen snapshot, so this never rewrites what current
 * clients already have.
 */
export default function PlansEditor() {
  const qc = useQueryClient();
  const { data: rows, isLoading } = useQuery({
    queryKey: ["plan-content-admin"],
    queryFn: async (): Promise<ServicePlanContent[]> => {
      const { data, error } = await supabase.from("service_plan_content").select("*").order("sort");
      if (error) throw error;
      return (data ?? []) as ServicePlanContent[];
    },
  });

  const [draft, setDraft] = useState<ServicePlanContent[]>([]);
  const [savingTier, setSavingTier] = useState<string | null>(null);
  useEffect(() => { if (rows) setDraft(rows); }, [rows]);

  function patch(tier: string, changes: Partial<ServicePlanContent>) {
    setDraft((d) => d.map((r) => (r.tier === tier ? { ...r, ...changes } : r)));
  }
  function setFeature(tier: string, key: FeatureKey, idx: number, value: string) {
    setDraft((d) => d.map((r) => (r.tier === tier ? { ...r, [key]: r[key].map((f, i) => (i === idx ? value : f)) } : r)));
  }
  function addFeature(tier: string, key: FeatureKey) {
    setDraft((d) => d.map((r) => (r.tier === tier ? { ...r, [key]: [...r[key], ""] } : r)));
  }
  function removeFeature(tier: string, key: FeatureKey, idx: number) {
    setDraft((d) => d.map((r) => (r.tier === tier ? { ...r, [key]: r[key].filter((_, i) => i !== idx) } : r)));
  }

  async function saveTier(row: ServicePlanContent) {
    setSavingTier(row.tier);
    const { error } = await supabase
      .from("service_plan_content")
      .update({
        name: row.name.trim(),
        label: row.label.trim(),
        tagline: row.tagline,
        price: Number(row.price),
        response_hours: Number(row.response_hours),
        hours: Number(row.hours),
        features_wp: row.features_wp.map((f) => f.trim()).filter(Boolean),
        features_custom: row.features_custom.map((f) => f.trim()).filter(Boolean),
        updated_at: new Date().toISOString(),
      })
      .eq("tier", row.tier);
    setSavingTier(null);
    if (error) return toastError(error.message || "השמירה נכשלה.");
    toast({ title: `${row.name} נשמר ✓`, description: "התוכן החדש חל על מצטרפים חדשים; לקוחות קיימים לא מושפעים.", variant: "success" });
    qc.invalidateQueries({ queryKey: ["plan-content-admin"] });
    qc.invalidateQueries({ queryKey: ["plan-config"] });
  }

  return (
    <div>
      <PageHeader
        title="עריכת חבילות"
        subtitle="מה כל חבילה כוללת, מחירים וזמנים. שינויים חלים על מצטרפים חדשים ומשדרגים; לקוחות קיימים שומרים על מה שאישרו."
      />

      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-64 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : (
        <div className="space-y-5">
          {draft.map((row) => (
            <Card key={row.tier} className="space-y-5 p-5">
              <div className="flex items-center gap-2">
                <PackageOpen className="size-5 text-primary" />
                <h2 className="font-heading text-lg font-bold text-foreground">{row.name}</h2>
              </div>

              {/* meta fields */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="שם החבילה"><Input value={row.name} onChange={(e) => patch(row.tier, { name: e.target.value })} /></Field>
                <Field label="כותרת (essence)"><Input value={row.label} onChange={(e) => patch(row.tier, { label: e.target.value })} /></Field>
                <Field label="מחיר חודשי (₪)"><Input type="number" value={row.price} onChange={(e) => patch(row.tier, { price: Number(e.target.value) })} /></Field>
                <Field label="זמן תגובה (שעות)"><Input type="number" value={row.response_hours} onChange={(e) => patch(row.tier, { response_hours: Number(e.target.value) })} /></Field>
                <Field label="שעות עבודה בחודש"><Input type="number" value={row.hours} onChange={(e) => patch(row.tier, { hours: Number(e.target.value) })} /></Field>
              </div>

              {/* feature lists */}
              <div className="grid gap-5 lg:grid-cols-2">
                <FeatureList
                  title="פיצ'רים, אתר WordPress"
                  items={row.features_wp}
                  onChange={(i, v) => setFeature(row.tier, "features_wp", i, v)}
                  onAdd={() => addFeature(row.tier, "features_wp")}
                  onRemove={(i) => removeFeature(row.tier, "features_wp", i)}
                />
                <FeatureList
                  title="פיצ'רים, אתר קוד"
                  items={row.features_custom}
                  onChange={(i, v) => setFeature(row.tier, "features_custom", i, v)}
                  onAdd={() => addFeature(row.tier, "features_custom")}
                  onRemove={(i) => removeFeature(row.tier, "features_custom", i)}
                />
              </div>

              <p className="text-xs text-muted-foreground">
                שורות "עד X שעות עבודה" ו"תגובה עד X שעות" נוספות אוטומטית מהמספרים למעלה, אין צורך להוסיף אותן ידנית.
              </p>

              <div className="flex justify-end">
                <Button onClick={() => saveTier(row)} disabled={savingTier === row.tier}>
                  <Save className="size-4" /> {savingTier === row.tier ? "שומר…" : `שמור ${row.name}`}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function FeatureList({
  title,
  items,
  onChange,
  onAdd,
  onRemove,
}: {
  title: string;
  items: string[];
  onChange: (idx: number, value: string) => void;
  onAdd: () => void;
  onRemove: (idx: number) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/30 p-3">
      <p className="mb-2 text-sm font-semibold text-foreground">{title}</p>
      <div className="space-y-2">
        {items.map((f, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input value={f} onChange={(e) => onChange(i, e.target.value)} className="flex-1" placeholder="תיאור הפיצ'ר" />
            <Button variant="ghost" size="icon" aria-label="מחק פיצ'ר" onClick={() => onRemove(i)}>
              <Trash2 className="size-4 text-muted-foreground" />
            </Button>
          </div>
        ))}
      </div>
      <Button variant="ghost" size="sm" className="mt-2 text-muted-foreground" onClick={onAdd}>
        <Plus className="size-4" /> הוסף פיצ'ר
      </Button>
    </div>
  );
}
