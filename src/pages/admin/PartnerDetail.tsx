import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Briefcase,
  Check,
  Coins,
  Gift,
  Handshake,
  Plus,
  Wallet,
  X,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectMenu } from "@/components/ui/select-menu";
import { CopyButton } from "@/components/ui/copy-button";
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
import { usePartnerDetail } from "@/hooks/usePartnerDetail";
import { GrantCoinsDialog } from "@/components/admin/GrantCoinsDialog";
import { rateLabel } from "@/hooks/usePartners";
import { referralDisplay, referralUrl } from "@/lib/referral";
import { leadStatusHe, leadStatusVariant, projectTypeHe } from "@/lib/status";

function ils(n: number | null | undefined) {
  return n == null ? "-" : `₪${n.toLocaleString("he-IL")}`;
}

function Stat({ icon: Icon, label, value }: { icon: typeof Wallet; label: string; value: string | number }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-sm">{label}</span>
      </div>
      <p className="mt-1 font-heading text-2xl font-black text-foreground">{value}</p>
    </Card>
  );
}

export default function PartnerDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { data, isLoading } = usePartnerDetail(id);
  const [addOpen, setAddOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [busyRedemption, setBusyRedemption] = useState<string | null>(null);

  async function setRedemption(redId: string, status: "fulfilled" | "cancelled" | "pending") {
    setBusyRedemption(redId);
    const { error } = await supabase.rpc("set_partner_redemption_status", {
      p_id: redId,
      p_status: status,
    });
    setBusyRedemption(null);
    if (error) return toastError(error.message || "עדכון המימוש נכשל.");
    toast({
      title:
        status === "fulfilled"
          ? "המימוש סומן כטופל ✓"
          : status === "cancelled"
            ? "המימוש בוטל והמטבעות הוחזרו"
            : "המימוש הוחזר לטיפול",
      variant: "success",
    });
    qc.invalidateQueries({ queryKey: ["partner-detail", id] });
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }
  if (!data?.profile) {
    return <EmptyState icon={Handshake} title="השותף לא נמצא" />;
  }

  const { profile, partner, leads, totalLeads, closedDeals, paidCommission, coins, redemptions } = data;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
        <Link to="/admin/partners">
          <ArrowRight className="size-4" /> לכל השותפים
        </Link>
      </Button>

      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            {profile.full_name || "שותף"}
            {partner && !partner.is_active && <Badge variant="secondary">מושהה</Badge>}
          </span>
        }
        subtitle={profile.email}
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setGiftOpen(true)}>
              <Gift className="size-4" /> מתנה
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <Plus className="size-4" /> הוספת עסקה
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat icon={Briefcase} label="עסקאות / לידים" value={totalLeads} />
        <Stat icon={Check} label="עסקאות שנסגרו" value={closedDeals} />
        <Stat icon={Wallet} label="סך עמלות ששולמו" value={ils(paidCommission)} />
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Handshake className="size-4" />
            <span className="text-sm">אחוז עמלה</span>
          </div>
          <p className="mt-1 font-heading text-2xl font-black text-foreground">
            {rateLabel(
              partner?.commission_rate,
              partner?.commission_rate_min,
              partner?.commission_rate_max
            )}
          </p>
          {partner && partner.boost_deals_left > 0 && (
            <p className="mt-1 text-xs text-primary">בוסט +{partner.boost_pct}% · {partner.boost_deals_left} עסקאות</p>
          )}
        </Card>
        <Stat icon={Coins} label="מטבעות" value={coins} />
      </div>

      {partner?.referral_code && (
        <Card className="space-y-4 p-5">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">לינק הפניה אישי</p>
            <p className="mt-1 break-all font-mono-code text-sm text-foreground">
              {referralDisplay(partner.referral_code)}
            </p>
          </div>
          <div className="flex">
            <CopyButton
              content={referralUrl(partner.referral_code)}
              label="העתקת לינק"
              toastMessage="לינק ההפניה הועתק"
              className="w-full sm:w-auto"
            />
          </div>
        </Card>
      )}

      <div>
        <h2 className="mb-3 font-heading text-lg font-bold text-foreground">עסקאות ולידים</h2>
        {leads.length === 0 ? (
          <EmptyState
            icon={Briefcase}
            title="אין עדיין עסקאות"
            description="הוסף עסקה רטרו על פרויקט שהשותף כבר קיבל עליו עמלה, או המתן ללידים חדשים."
            action={
              <Button onClick={() => setAddOpen(true)}>
                <Plus className="size-4" /> הוספת עסקה
              </Button>
            }
          />
        ) : (
          <div className="space-y-2">
            {leads.map((l) => (
              <Card key={l.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{l.lead_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {l.project_type ? projectTypeHe[l.project_type] : "פרויקט"}
                    {l.deal_value != null ? ` · עסקה ${ils(l.deal_value)}` : ""}
                    {l.commission_amount != null ? ` · עמלה ${ils(l.commission_amount)}` : ""}
                    {l.payment_confirmed_at
                      ? ` · שולם ${new Date(l.payment_confirmed_at).toLocaleDateString("he-IL")}`
                      : ""}
                  </p>
                </div>
                <Badge variant={leadStatusVariant[l.status]}>{leadStatusHe[l.status]}</Badge>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-3 flex items-center gap-2 font-heading text-lg font-bold text-foreground">
          <Gift className="size-5" /> מימושים בחנות
        </h2>
        {redemptions.length === 0 ? (
          <EmptyState
            icon={Gift}
            title="אין מימושים"
            description="כשהשותף יממש פרס בחנות, הוא יופיע כאן לאישור."
          />
        ) : (
          <div className="space-y-2">
            {redemptions.map((r) => (
              <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{r.reward?.name ?? "פרס"}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("he-IL")} · {r.coins_spent} מטבעות
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      r.status === "fulfilled"
                        ? "success"
                        : r.status === "cancelled"
                          ? "secondary"
                          : "warning"
                    }
                  >
                    {r.status === "fulfilled" ? "טופל" : r.status === "cancelled" ? "בוטל" : "ממתין"}
                  </Badge>
                  {r.status === "pending" && (
                    <Button
                      size="sm"
                      disabled={busyRedemption === r.id}
                      onClick={() => setRedemption(r.id, "fulfilled")}
                    >
                      <Check className="size-4" /> אישור
                    </Button>
                  )}
                  {r.status !== "cancelled" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busyRedemption === r.id}
                      onClick={() => setRedemption(r.id, "cancelled")}
                    >
                      <X className="size-4" /> ביטול
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <AddRetroDealDialog
        partnerId={id!}
        defaultRate={partner?.commission_rate ?? null}
        open={addOpen}
        onClose={() => setAddOpen(false)}
      />

      <GrantCoinsDialog
        open={giftOpen}
        onClose={() => setGiftOpen(false)}
        userId={id!}
        recipientName={profile.full_name || undefined}
        invalidateKeys={[["partner-detail", id]]}
      />
    </div>
  );
}

function AddRetroDealDialog({
  partnerId,
  defaultRate,
  open,
  onClose,
}: {
  partnerId: string;
  defaultRate: number | null;
  open: boolean;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    lead_name: "",
    deal_value: "",
    commission_amount: "",
    payment_method: "bank_transfer" as "bit" | "bank_transfer",
    payment_date: new Date().toISOString().slice(0, 10),
  });

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    const name = form.lead_name.trim();
    if (!name) return toastError("צריך שם פרויקט / לקוח.");
    const commission = Number(form.commission_amount);
    if (Number.isNaN(commission) || commission <= 0)
      return toastError("צריך להזין סכום עמלה ששולם.");
    const deal = form.deal_value.trim() ? Number(form.deal_value) : null;
    if (deal != null && (Number.isNaN(deal) || deal < 0))
      return toastError("ערך עסקה לא תקין.");

    setSaving(true);
    const { error } = await supabase.from("partner_leads").insert({
      partner_id: partnerId,
      lead_name: name,
      status: "closed",
      deal_value: deal,
      commission_rate_at_close:
        deal && deal > 0 ? Math.round((commission / deal) * 10000) / 100 : defaultRate,
      commission_amount: commission,
      payment_method: form.payment_method,
      payment_confirmed_at: new Date(form.payment_date).toISOString(),
      payment_confirmed_by: user?.id ?? null,
    });
    setSaving(false);
    if (error) return toastError("הוספת העסקה נכשלה.");

    toast({ title: "העסקה נוספה ✓", variant: "success" });
    qc.invalidateQueries({ queryKey: ["partner-detail", partnerId] });
    qc.invalidateQueries({ queryKey: ["admin-partner-leads"] });
    setForm({
      lead_name: "",
      deal_value: "",
      commission_amount: "",
      payment_method: "bank_transfer",
      payment_date: new Date().toISOString().slice(0, 10),
    });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>הוספת עסקה רטרו</DialogTitle>
          <DialogDescription>
            פרויקט שהשותף כבר קיבל עליו עמלה. נרשם כעסקה סגורה ומשולמת.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rd-name">שם הפרויקט / הלקוח</Label>
            <Input
              id="rd-name"
              value={form.lead_name}
              maxLength={160}
              onChange={(e) => update("lead_name", e.target.value)}
              placeholder="למשל: אתר תדמית — חברת X"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="rd-commission">עמלה ששולמה (₪)</Label>
              <Input
                id="rd-commission"
                dir="ltr"
                type="number"
                min="0"
                value={form.commission_amount}
                onChange={(e) => update("commission_amount", e.target.value)}
                placeholder="₪"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rd-deal">ערך העסקה (אופציונלי)</Label>
              <Input
                id="rd-deal"
                dir="ltr"
                type="number"
                min="0"
                value={form.deal_value}
                onChange={(e) => update("deal_value", e.target.value)}
                placeholder="₪"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label htmlFor="rd-method">אמצעי תשלום</Label>
              <SelectMenu
                id="rd-method"
                variant="field"
                ariaLabel="אמצעי תשלום"
                value={form.payment_method}
                onChange={(v) => update("payment_method", v as "bit" | "bank_transfer")}
                options={[
                  { value: "bank_transfer", label: "העברה בנקאית" },
                  { value: "bit", label: "ביט" },
                ]}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rd-date">תאריך התשלום</Label>
              <Input
                id="rd-date"
                dir="ltr"
                type="date"
                value={form.payment_date}
                onChange={(e) => update("payment_date", e.target.value)}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={saving}>
            {saving ? "שומר…" : "הוספה"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
