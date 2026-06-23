import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Handshake, Settings2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { RewardsStore } from "@/components/admin/RewardsStore";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectMenu } from "@/components/ui/select-menu";
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
import { useAdminReferrals, type AdminReferral } from "@/hooks/useAdminReferrals";
import { useNotifications } from "@/hooks/useNotifications";
import { referralStatusHe, referralStatusVariant } from "@/lib/status";
import type { ReferralStatus } from "@/types/database";

const STATUSES: ReferralStatus[] = [
  "submitted",
  "awaiting_intro",
  "intro_done",
  "quote_sent",
  "client_approved",
  "closed",
  "not_relevant",
];

export default function Referrals() {
  const { data, isLoading } = useAdminReferrals();
  const { items: notifs, unreadEntityIds, markRead } = useNotifications();
  const [active, setActive] = useState<AdminReferral | null>(null);

  function openReferral(r: AdminReferral) {
    setActive(r);
    // Clear the "new" mark for this referral.
    notifs
      .filter((n) => !n.is_read && n.entity_id === r.id)
      .forEach((n) => markRead(n.id));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="ניהול הפניות"
        subtitle="הפניות מהלקוחות, עדכון סטטוס, וחנות הפרסים."
      />

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : !data?.referrals.length ? (
        <EmptyState icon={Handshake} title="אין עדיין הפניות" />
      ) : (
        <div className="space-y-2">
          {data.referrals.map((r) => {
            const isNew = unreadEntityIds.has(r.id);
            return (
              <Card
                key={r.id}
                className={
                  "flex items-center justify-between gap-3 p-4" +
                  (isNew ? " border-primary/50 ring-1 ring-primary/30" : "")
                }
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">
                    {isNew && (
                      <span className="me-2 inline-block size-2 rounded-full bg-destructive align-middle" />
                    )}
                    {r.referred_name}
                    <span className="text-muted-foreground"> · מאת {r.referrer_name}</span>
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {r.referred_contact}
                    {r.deal_value ? ` · עסקה ₪${r.deal_value.toLocaleString("he-IL")}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {isNew && <Badge variant="default">חדש</Badge>}
                  <Badge variant={referralStatusVariant[r.status]}>
                    {referralStatusHe[r.status]}
                  </Badge>
                  <Button variant="ghost" size="icon" aria-label="ניהול" onClick={() => openReferral(r)}>
                    <Settings2 className="size-4" />
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Rewards store management */}
      {!isLoading && (
        <RewardsStore
          rewards={data?.rewards ?? []}
          ilsPerCoin={data?.ilsPerCoin ?? 1}
          giftValuePct={data?.giftValuePct ?? 75}
        />
      )}

      <ManageReferralDialog referral={active} onClose={() => setActive(null)} />
    </div>
  );
}

export function ManageReferralDialog({
  referral,
  onClose,
  initialStatus,
  onSaved,
}: {
  referral: AdminReferral | null;
  onClose: () => void;
  /** Preselect a status when opening (e.g. "closed" to jump straight to the deal fields). */
  initialStatus?: ReferralStatus;
  /** Called after a successful save, in addition to refreshing the admin referrals list. */
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [seeded, setSeeded] = useState<string | null>(null);
  const [form, setForm] = useState({
    status: "submitted" as ReferralStatus,
    deal_value: "",
    payment_method: "" as "" | "bit" | "bank_transfer",
    payment_confirmed: false,
  });

  if (referral && referral.id !== seeded) {
    setForm({
      status: initialStatus ?? referral.status,
      deal_value: referral.deal_value != null ? String(referral.deal_value) : "",
      payment_method: (referral.payment_method ?? "") as "" | "bit" | "bank_transfer",
      payment_confirmed: !!referral.payment_confirmed_at,
    });
    setSeeded(referral.id);
  }

  const deal = Number(form.deal_value) || 0;
  const fivePct = form.status === "closed" && deal > 0 ? Math.round(deal * 0.05) : null;

  async function save() {
    if (!referral) return;
    if (form.status === "closed" && !(deal > 0))
      return toastError("לסגירת עסקה צריך ערך עסקה.");

    setSaving(true);
    const isClosed = form.status === "closed";
    const { error } = await supabase
      .from("referrals")
      .update({
        status: form.status,
        deal_value: isClosed ? deal : null,
        payment_method: form.payment_method || null,
        payment_confirmed_at: form.payment_confirmed
          ? referral.payment_confirmed_at ?? new Date().toISOString()
          : null,
        payment_confirmed_by: form.payment_confirmed ? user?.id ?? null : null,
      })
      .eq("id", referral.id);

    if (error) {
      setSaving(false);
      return toastError("עדכון ההפניה נכשל.");
    }

    // Grant +5 credits once when the deal is closed.
    if (isClosed) {
      const { count } = await supabase
        .from("credit_transactions")
        .select("*", { count: "exact", head: true })
        .eq("referral_id", referral.id)
        .eq("reason", "deal_closed");
      if (!count) {
        await supabase.from("credit_transactions").insert({
          client_id: referral.referrer_id,
          amount: 5,
          reason: "deal_closed",
          referral_id: referral.id,
          note: "עסקה נסגרה",
          created_by: user?.id ?? null,
        });
      }
    }

    setSaving(false);
    toast({ title: "ההפניה עודכנה", variant: "success" });
    qc.invalidateQueries({ queryKey: ["admin-referrals"] });
    onSaved?.();
    onClose();
  }

  return (
    <Dialog open={!!referral} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>ניהול הפניה</DialogTitle>
          <DialogDescription>
            {referral ? `${referral.referred_name} · מאת ${referral.referrer_name}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rf-status">סטטוס</Label>
            <SelectMenu
              id="rf-status"
              variant="field"
              ariaLabel="סטטוס"
              value={form.status}
              onChange={(v) => setForm((f) => ({ ...f, status: v }))}
              options={STATUSES.map((s) => ({
                value: s,
                label: referralStatusHe[s],
              }))}
            />
          </div>

          {form.status === "closed" && (
            <div className="space-y-3 rounded-xl border border-border bg-muted p-3">
              <div className="space-y-1.5">
                <Label htmlFor="rf-deal">ערך העסקה (₪)</Label>
                <Input id="rf-deal" dir="ltr" type="number" min="0" value={form.deal_value}
                  onChange={(e) => setForm((f) => ({ ...f, deal_value: e.target.value }))} />
              </div>
              <p className="text-sm text-foreground">
                סגירה מזכה ב-<span className="font-semibold text-primary">5 קרדיטים</span>
                {fivePct != null && (
                  <> ובתשלום של <span className="font-semibold text-primary">₪{fivePct.toLocaleString("he-IL")}</span> (5%)</>
                )}
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="rf-method">אמצעי תשלום</Label>
                <SelectMenu
                  id="rf-method"
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
                <input type="checkbox" checked={form.payment_confirmed}
                  onChange={(e) => setForm((f) => ({ ...f, payment_confirmed: e.target.checked }))}
                  className="size-4 accent-[var(--primary)]" />
                אישור שהתשלום בוצע
              </label>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={saving}>
            {saving ? "שומר…" : "שמירה"}
          </Button>
          <Button variant="ghost" onClick={onClose}>ביטול</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

