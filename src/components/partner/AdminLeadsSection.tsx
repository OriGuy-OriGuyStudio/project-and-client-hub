import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Inbox, Settings2, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectMenu } from "@/components/ui/select-menu";
import { SortableTh, type SortDir } from "@/components/ui/sortable-th";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { toast, toastError } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useAllPartnerLeads, type AdminLead } from "@/hooks/useAllPartnerLeads";
import {
  leadStatusHe,
  leadStatusVariant,
  projectTypeHe,
} from "@/lib/status";
import type { PartnerLead, PartnerLeadStatus } from "@/types/database";

const STATUSES: PartnerLeadStatus[] = [
  "submitted",
  "awaiting_intro",
  "intro_done",
  "quote_sent",
  "client_approved",
  "closed",
  "not_relevant",
];

function ils(n: number | null | undefined) {
  return n == null ? "-" : `₪${n.toLocaleString("he-IL")}`;
}

type LeadSortKey = "name" | "partner" | "commission" | "status" | "created";

export function AdminLeadsSection() {
  const { data: leads, isLoading } = useAllPartnerLeads();
  const [active, setActive] = useState<AdminLead | null>(null);
  const [sort, setSort] = useState<{ key: LeadSortKey; dir: SortDir }>({
    key: "created",
    dir: "desc",
  });

  function toggleSort(key: LeadSortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  const sorted = useMemo(() => {
    const arr = [...(leads ?? [])];
    const d = sort.dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sort.key) {
        case "name":
          return a.lead_name.localeCompare(b.lead_name, "he") * d;
        case "partner":
          return a.partner_name.localeCompare(b.partner_name, "he") * d;
        case "commission":
          return ((a.commission_amount ?? 0) - (b.commission_amount ?? 0)) * d;
        case "status":
          return a.status.localeCompare(b.status) * d;
        case "created":
          return (
            (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * d
          );
        default:
          return 0;
      }
    });
    return arr;
  }, [leads, sort]);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Inbox className="size-5 text-brand-cyan-base" />
        <h2 className="font-heading text-lg font-bold text-foreground">
          לידים מהשותפים
        </h2>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      ) : !leads?.length ? (
        <EmptyState
          icon={Inbox}
          title="אין עדיין לידים"
          description="לידים שהשותפים יגישו יופיעו כאן לטיפול."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60">
                <SortableTh label="ליד" active={sort.key === "name"} dir={sort.dir} onClick={() => toggleSort("name")} />
                <SortableTh label="שותף" active={sort.key === "partner"} dir={sort.dir} onClick={() => toggleSort("partner")} />
                <th className="px-3 py-2 text-start font-medium text-muted-foreground">סוג</th>
                <th className="px-3 py-2 text-start font-medium text-muted-foreground">טלפון</th>
                <SortableTh label="עמלה" active={sort.key === "commission"} dir={sort.dir} onClick={() => toggleSort("commission")} />
                <SortableTh label="סטטוס" active={sort.key === "status"} dir={sort.dir} onClick={() => toggleSort("status")} />
                <SortableTh label="תאריך" active={sort.key === "created"} dir={sort.dir} onClick={() => toggleSort("created")} />
                <th className="px-3 py-2 text-start font-medium text-muted-foreground">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {sorted.map((l) => (
                <tr key={l.id} className="text-foreground">
                  <td className="px-3 py-2.5 font-medium">{l.lead_name}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{l.partner_name}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">
                    {l.project_type ? projectTypeHe[l.project_type] : "-"}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground" dir="ltr">
                    {l.lead_phone || "-"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                    {ils(l.commission_amount)}
                    {l.payment_confirmed_at ? " ✓" : ""}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant={leadStatusVariant[l.status]}>{leadStatusHe[l.status]}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                    {new Date(l.created_at).toLocaleDateString("he-IL")}
                  </td>
                  <td className="px-3 py-2.5">
                    <Button variant="ghost" size="icon" aria-label="ניהול" onClick={() => setActive(l)}>
                      <Settings2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ManageLeadDialog lead={active} onClose={() => setActive(null)} />
    </section>
  );
}

export function ManageLeadDialog({
  lead,
  onClose,
  initialStatus,
  onSaved,
}: {
  lead: AdminLead | null;
  onClose: () => void;
  /** Preselect a status when opening (e.g. "closed" to jump straight to the deal fields). */
  initialStatus?: PartnerLeadStatus;
  /** Called after a successful save, in addition to refreshing the admin leads list. */
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [seeded, setSeeded] = useState<string | null>(null);
  const [form, setForm] = useState({
    status: "submitted" as PartnerLeadStatus,
    deal_value: "",
    rate: "",
    payment_method: "" as "" | "bit" | "bank_transfer",
    payment_confirmed: false,
  });

  if (lead && lead.id !== seeded) {
    setForm({
      status: initialStatus ?? lead.status,
      deal_value: lead.deal_value != null ? String(lead.deal_value) : "",
      rate: String(lead.commission_rate_at_close ?? lead.partner_commission_rate ?? ""),
      payment_method: (lead.payment_method ?? "") as "" | "bit" | "bank_transfer",
      payment_confirmed: !!lead.payment_confirmed_at,
    });
    setSeeded(lead.id);
  }

  const hasRange =
    lead?.partner_rate_min != null &&
    lead?.partner_rate_max != null &&
    lead.partner_rate_min !== lead.partner_rate_max;
  const rate = Number(form.rate) || 0;
  const dealNum = Number(form.deal_value) || 0;
  const commissionPreview =
    form.status === "closed" && dealNum > 0
      ? Math.round(((dealNum * rate) / 100) * 100) / 100
      : null;

  async function save() {
    if (!lead) return;
    if (form.status === "closed" && !(Number(form.deal_value) > 0)) {
      toastError("לסגירת עסקה צריך להזין ערך עסקה.");
      return;
    }
    if (form.payment_confirmed && !form.payment_method) {
      toastError("בחר אמצעי תשלום לפני אישור.");
      return;
    }

    setSaving(true);
    const isClosed = form.status === "closed";
    const deal = Number(form.deal_value) || null;

    const patch: Partial<PartnerLead> = {
      status: form.status,
      deal_value: deal,
      commission_rate_at_close: isClosed ? rate : lead.commission_rate_at_close,
      commission_amount: commissionPreview ?? (isClosed ? lead.commission_amount : null),
      payment_method: form.payment_method || null,
      payment_confirmed_at: form.payment_confirmed
        ? lead.payment_confirmed_at ?? new Date().toISOString()
        : null,
      payment_confirmed_by: form.payment_confirmed ? user?.id ?? null : null,
    };

    const { error } = await supabase
      .from("partner_leads")
      .update(patch)
      .eq("id", lead.id);
    setSaving(false);
    if (error) return toastError("עדכון הליד נכשל.");

    toast({ title: "הליד עודכן", variant: "success" });
    qc.invalidateQueries({ queryKey: ["admin-partner-leads"] });
    onSaved?.();
    onClose();
  }

  return (
    <Dialog open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>ניהול ליד</DialogTitle>
          <DialogDescription>
            {lead
              ? `${lead.lead_name} · ${lead.partner_name}${
                  hasRange
                    ? ` (${lead.partner_rate_min}%–${lead.partner_rate_max}%)`
                    : lead.partner_commission_rate != null
                      ? ` (${lead.partner_commission_rate}%)`
                      : ""
                }`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="m-status">סטטוס</Label>
            <SelectMenu
              id="m-status"
              variant="field"
              ariaLabel="סטטוס"
              value={form.status}
              onChange={(v) => setForm((f) => ({ ...f, status: v }))}
              options={STATUSES.map((s) => ({
                value: s,
                label: leadStatusHe[s],
              }))}
            />
          </div>

          {form.status === "closed" && (
            <div className="space-y-3 rounded-xl border border-border bg-muted p-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <Label htmlFor="m-deal">ערך העסקה (₪)</Label>
                  <Input id="m-deal" dir="ltr" type="number" min="0"
                    value={form.deal_value}
                    onChange={(e) => setForm((f) => ({ ...f, deal_value: e.target.value }))} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="m-rate">אחוז עמלה</Label>
                  <Input id="m-rate" dir="ltr" type="number" step="0.5" min="0" max="100"
                    value={form.rate}
                    onChange={(e) => setForm((f) => ({ ...f, rate: e.target.value }))} />
                </div>
              </div>
              {hasRange && (
                <p className="text-xs text-muted-foreground">
                  טווח מוסכם: {lead!.partner_rate_min}%–{lead!.partner_rate_max}%
                </p>
              )}
              <p className="text-sm text-foreground">
                עמלה לתשלום:{" "}
                <span className="font-semibold text-primary">
                  {commissionPreview != null ? ils(commissionPreview) : "-"}
                </span>
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="m-method">אמצעי תשלום</Label>
                <SelectMenu
                  id="m-method"
                  variant="field"
                  ariaLabel="אמצעי תשלום"
                  placeholder="בחר…"
                  value={form.payment_method}
                  onChange={(v) => setForm((f) => ({ ...f, payment_method: v }))}
                  options={[
                    { value: "bit", label: "ביט" },
                    { value: "bank_transfer", label: "העברה בנקאית" },
                  ]}
                />
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={form.payment_confirmed}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, payment_confirmed: e.target.checked }))
                  }
                  className="size-4 accent-[var(--primary)]"
                />
                <Wallet className="size-4 text-primary" />
                אישור שהעמלה שולמה לשותף
              </label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={saving}>
            {saving ? "שומר…" : "שמירה"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
