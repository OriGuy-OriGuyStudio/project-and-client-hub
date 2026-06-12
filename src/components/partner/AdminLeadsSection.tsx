import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Inbox, Settings2, Wallet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/sheet";
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
  "in_review",
  "quote_sent",
  "interested",
  "closed",
  "not_relevant",
];

function ils(n: number | null | undefined) {
  return n == null ? "—" : `₪${n.toLocaleString("he-IL")}`;
}

export function AdminLeadsSection() {
  const { data: leads, isLoading } = useAllPartnerLeads();
  const [active, setActive] = useState<AdminLead | null>(null);

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
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : !leads?.length ? (
        <EmptyState
          icon={Inbox}
          title="אין עדיין לידים"
          description="לידים שהשותפים יגישו יופיעו כאן לטיפול."
        />
      ) : (
        <div className="space-y-2">
          {leads.map((l) => (
            <Card key={l.id} className="flex items-center justify-between gap-3 p-4">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">
                  {l.lead_name}
                  <span className="text-muted-foreground"> · {l.partner_name}</span>
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {l.project_type ? projectTypeHe[l.project_type] : "—"}
                  {l.lead_phone ? ` · ${l.lead_phone}` : ""}
                  {l.commission_amount ? ` · עמלה ${ils(l.commission_amount)}` : ""}
                  {l.payment_confirmed_at ? " · שולם" : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge variant={leadStatusVariant[l.status]}>
                  {leadStatusHe[l.status]}
                </Badge>
                <Button variant="ghost" size="icon" aria-label="ניהול" onClick={() => setActive(l)}>
                  <Settings2 className="size-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ManageLeadDialog lead={active} onClose={() => setActive(null)} />
    </section>
  );
}

function ManageLeadDialog({
  lead,
  onClose,
}: {
  lead: AdminLead | null;
  onClose: () => void;
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
      status: lead.status,
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
    onClose();
  }

  return (
    <Dialog open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
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
            <select
              id="m-status"
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({ ...f, status: e.target.value as PartnerLeadStatus }))
              }
              className="flex h-10 w-full rounded-xl border border-input bg-field px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {leadStatusHe[s]}
                </option>
              ))}
            </select>
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
                  {commissionPreview != null ? ils(commissionPreview) : "—"}
                </span>
              </p>

              <div className="space-y-1.5">
                <Label htmlFor="m-method">אמצעי תשלום</Label>
                <select
                  id="m-method"
                  value={form.payment_method}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      payment_method: e.target.value as "" | "bit" | "bank_transfer",
                    }))
                  }
                  className="flex h-10 w-full rounded-xl border border-input bg-field px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <option value="">בחר…</option>
                  <option value="bit">ביט</option>
                  <option value="bank_transfer">העברה בנקאית</option>
                </select>
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
