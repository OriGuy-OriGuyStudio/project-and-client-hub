import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Gift, Handshake, Plus, Settings2, Sparkles, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
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
  DialogTrigger,
} from "@/components/ui/sheet";
import { supabase } from "@/lib/supabase";
import { toast, toastError } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useAdminReferrals, type AdminReferral } from "@/hooks/useAdminReferrals";
import { useNotifications } from "@/hooks/useNotifications";
import { clampText } from "@/lib/sanitize";
import { referralStatusHe, referralStatusVariant } from "@/lib/status";
import type { ReferralStatus } from "@/types/database";

const STATUSES: ReferralStatus[] = ["submitted", "in_progress", "closed", "not_relevant"];

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
        actions={<RewardDialog />}
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
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Gift className="size-5 text-brand-cyan-base" />
          <h2 className="font-heading text-lg font-bold text-foreground">חנות הפרסים</h2>
        </div>
        {data?.rewards.length ? (
          <div className="space-y-2">
            {data.rewards.map((rw) => (
              <RewardRow key={rw.id} reward={rw} />
            ))}
          </div>
        ) : (
          <EmptyState icon={Gift} title="אין עדיין פרסים" />
        )}
      </section>

      <ManageReferralDialog referral={active} onClose={() => setActive(null)} />
    </div>
  );
}

function ManageReferralDialog({
  referral,
  onClose,
}: {
  referral: AdminReferral | null;
  onClose: () => void;
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
      status: referral.status,
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
            <select
              id="rf-status"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ReferralStatus }))}
              className="flex h-10 w-full rounded-xl border border-input bg-background/40 px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {referralStatusHe[s]}
                </option>
              ))}
            </select>
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
                <select
                  id="rf-method"
                  value={form.payment_method}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, payment_method: e.target.value as "" | "bit" | "bank_transfer" }))
                  }
                  className="flex h-10 w-full rounded-xl border border-input bg-background/40 px-3 text-sm text-foreground"
                >
                  <option value="">בחר…</option>
                  <option value="bit">ביט</option>
                  <option value="bank_transfer">העברה בנקאית</option>
                </select>
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

function RewardRow({ reward }: { reward: import("@/types/database").Reward }) {
  const qc = useQueryClient();
  async function toggle() {
    const { error } = await supabase
      .from("rewards")
      .update({ is_active: !reward.is_active })
      .eq("id", reward.id);
    if (error) return toastError("העדכון נכשל.");
    qc.invalidateQueries({ queryKey: ["admin-referrals"] });
  }
  async function remove() {
    const { error } = await supabase.from("rewards").delete().eq("id", reward.id);
    if (error) return toastError("המחיקה נכשלה.");
    qc.invalidateQueries({ queryKey: ["admin-referrals"] });
  }
  return (
    <Card className="flex items-center justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="truncate font-medium text-foreground">{reward.name}</p>
        {reward.description && (
          <p className="truncate text-xs text-muted-foreground">{reward.description}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Badge variant={reward.is_active ? "success" : "secondary"}>
          <Sparkles className="size-3" /> {reward.credit_cost}
        </Badge>
        <Button size="sm" variant="ghost" onClick={toggle}>
          {reward.is_active ? "השבת" : "הפעל"}
        </Button>
        <Button variant="ghost" size="icon" className="text-destructive" aria-label="מחיקה" onClick={remove}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </Card>
  );
}

function RewardDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", credit_cost: "100" });

  async function save() {
    const name = clampText(form.name.trim(), 120);
    const cost = Number(form.credit_cost);
    if (!name) return toastError("תן שם לפרס.");
    if (!Number.isInteger(cost) || cost <= 0) return toastError("עלות קרדיטים לא תקינה.");
    setSaving(true);
    const { error } = await supabase.from("rewards").insert({
      name,
      description: clampText(form.description.trim(), 300) || null,
      credit_cost: cost,
      reward_type: "custom",
    });
    setSaving(false);
    if (error) return toastError("הוספת הפרס נכשלה.");
    toast({ title: "הפרס נוסף", variant: "success" });
    qc.invalidateQueries({ queryKey: ["admin-referrals"] });
    setForm({ name: "", description: "", credit_cost: "100" });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary">
          <Plus className="size-4" /> פרס חדש
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>הוספת פרס</DialogTitle>
          <DialogDescription>פרס שהלקוחות יוכלו לממש בקרדיטים.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rw-name">שם הפרס</Label>
            <Input id="rw-name" value={form.name} maxLength={120}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rw-desc">תיאור</Label>
            <Input id="rw-desc" value={form.description} maxLength={300}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rw-cost">עלות בקרדיטים</Label>
            <Input id="rw-cost" dir="ltr" type="number" min="1" value={form.credit_cost}
              onChange={(e) => setForm((f) => ({ ...f, credit_cost: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving}>{saving ? "מוסיף…" : "הוספה"}</Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>ביטול</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
