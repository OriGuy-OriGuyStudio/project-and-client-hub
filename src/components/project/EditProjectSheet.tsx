import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectMenu } from "@/components/ui/select-menu";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { supabase } from "@/lib/supabase";
import { toast, toastError } from "@/hooks/use-toast";
import { clampText } from "@/lib/sanitize";
import { cn } from "@/lib/utils";
import { logActivity } from "@/lib/activity";
import { useAuth } from "@/hooks/useAuth";
import { useClients } from "@/hooks/useClients";
import { useProjects } from "@/hooks/useProjects";
import { useProjectBilling, saveProjectValue } from "@/hooks/useTimeData";
import { useProjectService, useProjectServiceMoney } from "@/hooks/useService";
import { TIER_META } from "@/lib/service-plans";
import { projectStatusHe } from "@/lib/status";
import type { Project, ProjectStatus } from "@/types/database";

const STATUSES: ProjectStatus[] = ["active", "on_hold", "completed", "cancelled"];

/**
 * Admin-only "edit project details" panel — name, description, status, and the
 * warranty start date (setting/clearing it starts or stops the warranty clock).
 * The link fields live in ProjectHero's own inline editor.
 */
export function EditProjectSheet({ project }: { project: Project }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: clients } = useClients();
  const { data: allProjects = [] } = useProjects();
  const activeClients = clients?.active ?? [];
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    client_id: project.client_id,
    title: project.title,
    description: project.description ?? "",
    status: project.status,
    warranty_start_date: project.warranty_start_date ?? "",
    parent_project_id: project.parent_project_id ?? "",
    retainer_billed: project.retainer_billed ?? true,
  });

  function update<K extends keyof typeof draft>(k: K, v: (typeof draft)[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  // Project value (admin-only, hidden from clients) — used for the ₪/hour metric.
  const { data: billing } = useProjectBilling(project.id);
  const [value, setValue] = useState("");
  useEffect(() => {
    setValue(billing?.value != null ? String(billing.value) : "");
  }, [billing]);

  // Service & maintenance plan (shown to the client on "השירות שלך").
  const { data: service } = useProjectService(project.id);
  // Money (hourly_rate) now lives in the finance-gated project_service_money
  // table; the admin reads it here to prefill the rate field.
  const { data: serviceMoney } = useProjectServiceMoney(project.id);
  const [svcTier, setSvcTier] = useState<"none" | "core" | "pro" | "ultra">("none");
  const [svcSiteType, setSvcSiteType] = useState<"wordpress" | "custom">("wordpress");
  const [svcUrl, setSvcUrl] = useState("");
  const [svcBillingDay, setSvcBillingDay] = useState("1");
  const [svcHourly, setSvcHourly] = useState("");
  useEffect(() => {
    setSvcTier(service && service.active ? service.tier : "none");
    setSvcSiteType(service?.site_type ?? "wordpress");
    setSvcUrl(service?.site_url ?? "");
    setSvcBillingDay(String(service?.billing_day ?? 1));
  }, [service]);
  useEffect(() => {
    setSvcHourly(serviceMoney?.hourly_rate != null ? String(serviceMoney.hourly_rate) : "");
  }, [serviceMoney]);

  async function save() {
    const title = clampText(draft.title.trim(), 200);
    if (!title) return toastError("תן שם לפרויקט.");

    setSaving(true);
    const { error } = await supabase
      .from("projects")
      .update({
        client_id: draft.client_id,
        title,
        description: clampText(draft.description.trim(), 2000) || null,
        status: draft.status,
        warranty_start_date: draft.warranty_start_date || null,
        parent_project_id: draft.parent_project_id || null,
        retainer_billed: draft.parent_project_id ? draft.retainer_billed : true,
      })
      .eq("id", project.id);

    if (error) {
      setSaving(false);
      return toastError("שמירת הפרטים נכשלה.");
    }

    const trimmed = value.trim();
    await saveProjectValue(project.id, trimmed ? Number(trimmed) : null);
    qc.invalidateQueries({ queryKey: ["project-billing", project.id] });

    // service plan: a linked (child) project inherits the parent's package and
    // never carries its own, so deactivate any stray plan. Otherwise upsert.
    if (draft.parent_project_id) {
      await supabase
        .from("project_service")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("project_id", project.id);
    } else {
      const billingDay = Math.min(28, Math.max(1, parseInt(svcBillingDay || "1", 10)));
      await supabase.from("project_service").upsert(
        {
          project_id: project.id,
          tier: svcTier === "none" ? "core" : svcTier,
          site_type: svcSiteType,
          site_url: svcUrl.trim() || null,
          billing_day: billingDay,
          active: svcTier !== "none",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "project_id" },
      );
      // Money lives in the finance-gated companion table (admin-writable).
      await supabase.from("project_service_money").upsert(
        { project_id: project.id, hourly_rate: svcHourly.trim() ? Number(svcHourly) : null },
        { onConflict: "project_id" },
      );
    }
    qc.invalidateQueries({ queryKey: ["project-service", project.id] });
    qc.invalidateQueries({ queryKey: ["project-service-money", project.id] });
    qc.invalidateQueries({ queryKey: ["my-services"] });
    setSaving(false);

    await logActivity({
      projectId: project.id,
      actorId: user?.id ?? null,
      actionType: "project_updated",
      description: `פרטי הפרויקט עודכנו (${title})`,
    });
    toast({ title: "הפרטים נשמרו", variant: "success" });
    qc.invalidateQueries({ queryKey: ["project", project.id] });
    qc.invalidateQueries({ queryKey: ["projects"] });
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="sm" className="text-muted-foreground">
          <Pencil className="size-4" /> עריכת פרטים
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>עריכת פרטי הפרויקט</SheetTitle>
          <SheetDescription>
            שם, תיאור, סטטוס ותאריך תחילת האחריות. לעריכת הקישורים השתמש ב״עריכת
            קישורים״ בכרטיס הפרויקט.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ep-client">לקוח משויך</Label>
            <SelectMenu
              id="ep-client"
              variant="field"
              ariaLabel="לקוח"
              placeholder="בחר לקוח…"
              value={draft.client_id}
              onChange={(v) => update("client_id", v)}
              options={activeClients.map((c) => ({
                value: c.id,
                label: c.full_name ? `${c.full_name} · ${c.email}` : c.email,
              }))}
            />
            <p className="text-xs text-muted-foreground">
              שינוי הלקוח מעביר את הפרויקט לחשבון אחר, והלקוח הקודם יפסיק לראות אותו.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ep-parent">מקושר לפרויקט אב (ריטיינר)</Label>
            <SelectMenu
              id="ep-parent"
              variant="field"
              ariaLabel="פרויקט אב"
              placeholder="ללא , פרויקט עצמאי"
              value={draft.parent_project_id}
              onChange={(v) => update("parent_project_id", v)}
              options={[
                { value: "", label: "ללא , פרויקט עצמאי" },
                ...allProjects
                  .filter((p) => p.id !== project.id && p.client_id === draft.client_id)
                  .map((p) => ({ value: p.id, label: p.title })),
              ]}
            />
            <p className="text-xs text-muted-foreground">
              אם זה פיצ׳ר של פרויקט קיים, קשר אותו לפרויקט האב.
            </p>
            {draft.parent_project_id && (
              <div className="flex gap-1 rounded-xl border border-border/60 bg-background/40 p-1">
                <button
                  type="button"
                  onClick={() => update("retainer_billed", true)}
                  className={cn(
                    "flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    draft.retainer_billed ? "bg-primary text-[color:var(--ink,#0a0623)]" : "text-muted-foreground",
                  )}
                >
                  נספר בריטיינר
                </button>
                <button
                  type="button"
                  onClick={() => update("retainer_billed", false)}
                  className={cn(
                    "flex-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    !draft.retainer_billed ? "bg-primary text-[color:var(--ink,#0a0623)]" : "text-muted-foreground",
                  )}
                >
                  מקושר בלבד (עצמאי)
                </button>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ep-title">שם הפרויקט</Label>
            <Input
              id="ep-title"
              value={draft.title}
              maxLength={200}
              onChange={(e) => update("title", e.target.value)}
              placeholder="לדוגמה: אתר תדמית"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ep-desc">תיאור</Label>
            <Textarea
              id="ep-desc"
              value={draft.description}
              maxLength={2000}
              onChange={(e) => update("description", e.target.value)}
              placeholder="כמה מילים על הפרויקט"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ep-status">סטטוס</Label>
              <SelectMenu
                id="ep-status"
                variant="field"
                ariaLabel="סטטוס"
                value={draft.status}
                onChange={(v) => update("status", v as ProjectStatus)}
                options={STATUSES.map((s) => ({
                  value: s,
                  label: projectStatusHe[s],
                }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ep-warranty">תחילת אחריות</Label>
              <Input
                id="ep-warranty"
                type="date"
                value={draft.warranty_start_date}
                onChange={(e) => update("warranty_start_date", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ep-value">שווי הפרויקט (₪)</Label>
            <Input
              id="ep-value"
              type="number"
              inputMode="numeric"
              placeholder="לדוגמה: 12000"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              פנימי, לא נחשף ללקוח. משמש לחישוב ₪ לשעה בטיימר לפי הזמן שנמדד.
            </p>
          </div>

          {/* service & maintenance plan (shown to the client) */}
          {draft.parent_project_id ? (
            <div className="rounded-xl border border-border/60 bg-background/20 p-3 text-xs text-muted-foreground">
              חבילת השירות מנוהלת בפרויקט האב. פרויקט מקושר לא מחזיק חבילה או תעריף
              נפרדים, וכל השעות נספרות בריטיינר של האב.
            </div>
          ) : (
          <div className="space-y-3 rounded-xl border border-border/60 bg-background/20 p-3">
            <p className="text-sm font-semibold text-foreground">חבילת שירות ותחזוקה</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>חבילה</Label>
                <SelectMenu
                  variant="field"
                  ariaLabel="חבילה"
                  value={svcTier}
                  onChange={(v) => setSvcTier(v as typeof svcTier)}
                  options={[
                    { value: "none", label: "ללא חבילה" },
                    { value: "core", label: `Core (₪${TIER_META.core.price})` },
                    { value: "pro", label: `Pro (₪${TIER_META.pro.price})` },
                    { value: "ultra", label: `Ultra VIP (₪${TIER_META.ultra.price})` },
                  ]}
                />
              </div>
              <div className="space-y-1.5">
                <Label>סוג אתר</Label>
                <SelectMenu
                  variant="field"
                  ariaLabel="סוג אתר"
                  disabled={svcTier === "none"}
                  value={svcSiteType}
                  onChange={(v) => setSvcSiteType(v as typeof svcSiteType)}
                  options={[
                    { value: "wordpress", label: "WordPress" },
                    { value: "custom", label: "מותאם אישית" },
                  ]}
                />
              </div>
            </div>
            {svcTier !== "none" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ep-svc-url">כתובת האתר (לניטור)</Label>
                  <Input
                    id="ep-svc-url"
                    placeholder="https://…"
                    value={svcUrl}
                    onChange={(e) => setSvcUrl(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ep-svc-day">יום חיוב</Label>
                  <Input
                    id="ep-svc-day"
                    type="number"
                    min={1}
                    max={28}
                    value={svcBillingDay}
                    onChange={(e) => setSvcBillingDay(e.target.value)}
                  />
                </div>
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="ep-svc-rate">תעריף שעתי (₪)</Label>
                  <Input
                    id="ep-svc-rate"
                    type="number"
                    inputMode="numeric"
                    placeholder="לדוגמה: 160"
                    value={svcHourly}
                    onChange={(e) => setSvcHourly(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    משמש לחישוב שווי החבילה שמוצג ללקוח (שעות × תעריף) ולחריגת שעות.
                  </p>
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              נחשף ללקוח בעמוד ״השירות שלך״. כתובת האתר משמשת לניטור הביצועים והאבטחה.
            </p>
          </div>
          )}
        </div>

        <SheetFooter>
          <Button onClick={save} disabled={saving}>
            {saving ? "שומר…" : "שמירה"}
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            ביטול
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
