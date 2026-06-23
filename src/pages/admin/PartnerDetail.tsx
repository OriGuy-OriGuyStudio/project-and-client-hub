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
  Unlock,
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
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { toast, toastError } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { usePartnerDetail } from "@/hooks/usePartnerDetail";
import { GrantCoinsDialog } from "@/components/admin/GrantCoinsDialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CoinGrantsAudit } from "@/components/admin/CoinGrantsAudit";
import { sendRedemptionNotice } from "@/lib/invite";
import { rateLabel } from "@/hooks/usePartners";
import { referralDisplay, referralUrl } from "@/lib/referral";
import { leadStatusHe, leadStatusVariant, projectTypeHe } from "@/lib/status";
import { StatusPipeline } from "@/components/partner/StatusPipeline";
import type { PartnerLeadStatus } from "@/types/database";

function ils(n: number | null | undefined) {
  return n == null ? "-" : `₪${n.toLocaleString("he-IL")}`;
}

// Inline stage editing covers the funnel up to "client_approved"; closing a deal
// (with value + commission) stays in the dedicated close form, and not_relevant
// marks a drop.
const LEAD_EDIT_STATUSES: PartnerLeadStatus[] = [
  "submitted",
  "awaiting_intro",
  "intro_done",
  "quote_sent",
  "client_approved",
  "not_relevant",
];

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
  const [closeLead, setCloseLead] = useState<{ id: string; name: string } | null>(null);
  const [giftOpen, setGiftOpen] = useState(false);
  const [busyRedemption, setBusyRedemption] = useState<string | null>(null);
  const [releaseTarget, setReleaseTarget] = useState<{ id: string; name?: string } | null>(null);

  async function setRedemption(
    redId: string,
    status: "fulfilled" | "cancelled" | "pending",
    rewardName?: string
  ) {
    setBusyRedemption(redId);
    const { error } = await supabase.rpc("set_partner_redemption_status", {
      p_id: redId,
      p_status: status,
    });
    setBusyRedemption(null);
    if (error) return toastError(error.message || "עדכון המימוש נכשל.");
    if (status === "fulfilled" && id) void sendRedemptionNotice(id, rewardName || "");
    toast({
      title:
        status === "fulfilled"
          ? "המימוש סומן כטופל ✓"
          : status === "cancelled"
            ? "המימוש סומן כלא אושר והמטבעות הוחזרו"
            : "המימוש הוחזר לטיפול",
      variant: "success",
    });
    qc.invalidateQueries({ queryKey: ["partner-detail", id] });
  }

  async function updateLeadStatus(leadId: string, status: PartnerLeadStatus) {
    const { error } = await supabase.from("partner_leads").update({ status }).eq("id", leadId);
    if (error) return toastError("עדכון הסטטוס נכשל.");
    toast({ title: "הסטטוס עודכן", variant: "success" });
    qc.invalidateQueries({ queryKey: ["partner-detail", id] });
  }

  // Cancel ALL of this partner's active redemptions of a reward, freeing it again.
  async function releaseReward(rewardId: string, rewardName?: string) {
    const targets = (data?.redemptions ?? []).filter(
      (r) => r.reward_id === rewardId && r.status !== "cancelled"
    );
    if (!targets.length) return;
    setBusyRedemption("release-" + rewardId);
    for (const t of targets) {
      const { error } = await supabase.rpc("set_partner_redemption_status", {
        p_id: t.id,
        p_status: "cancelled",
      });
      if (error) {
        setBusyRedemption(null);
        return toastError(error.message || "שחרור הפרס נכשל.");
      }
    }
    setBusyRedemption(null);
    toast({ title: `"${rewardName ?? "הפרס"}" שוחרר. השותף יכול לממש שוב`, variant: "success" });
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

  const { profile, partner, leads, totalLeads, closedDeals, paidCommission, coins, redemptions, grants, curious } = data;

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
            {curious && (
              <Badge variant="success" title="גילה את ה-Easter Egg והרוויח 5 מטבעות">
                🔭 סקרן
              </Badge>
            )}
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
              <Card key={l.id} className="space-y-3 p-4">
                <div className="flex items-start justify-between gap-3">
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
                  {l.status === "closed" ? (
                    <Badge variant={leadStatusVariant.closed} className="shrink-0">
                      {leadStatusHe.closed}
                    </Badge>
                  ) : (
                    <div className="w-40 shrink-0">
                      <SelectMenu
                        ariaLabel="סטטוס הליד"
                        variant="field"
                        value={l.status}
                        onChange={(v) => {
                          if (v === "closed") setCloseLead({ id: l.id, name: l.lead_name });
                          else updateLeadStatus(l.id, v as PartnerLeadStatus);
                        }}
                        options={[...LEAD_EDIT_STATUSES, "closed" as PartnerLeadStatus].map((s) => ({
                          value: s,
                          label: leadStatusHe[s],
                        }))}
                      />
                    </div>
                  )}
                </div>
                <StatusPipeline status={l.status} />
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
              <Card
                key={r.id}
                className={
                  "flex flex-wrap items-center justify-between gap-3 p-4" +
                  (r.status === "pending" ? "" : " opacity-60")
                }
              >
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
                    {r.status === "fulfilled" ? "טופל" : r.status === "cancelled" ? "לא אושר" : "ממתין"}
                  </Badge>
                  {r.status === "pending" && (
                    <Button
                      size="sm"
                      disabled={busyRedemption === r.id}
                      onClick={() => setRedemption(r.id, "fulfilled", r.reward?.name)}
                    >
                      <Check className="size-4" /> אישור
                    </Button>
                  )}
                  {r.status === "pending" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busyRedemption === r.id}
                      onClick={() => setRedemption(r.id, "cancelled")}
                    >
                      <X className="size-4" /> לא אושר
                    </Button>
                  )}
                  {r.status === "fulfilled" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyRedemption === "release-" + r.reward_id}
                      onClick={() => setReleaseTarget({ id: r.reward_id, name: r.reward?.name })}
                    >
                      <Unlock className="size-4" /> שחרר פרס
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CoinGrantsAudit grants={grants} />

      <AddRetroDealDialog
        partnerId={id!}
        defaultRate={partner?.commission_rate ?? null}
        open={addOpen}
        onClose={() => setAddOpen(false)}
      />

      <CloseLeadDialog
        lead={closeLead}
        partnerId={id!}
        onClose={() => setCloseLead(null)}
      />

      <GrantCoinsDialog
        open={giftOpen}
        onClose={() => setGiftOpen(false)}
        userId={id!}
        recipientName={profile.full_name || undefined}
        invalidateKeys={[["partner-detail", id]]}
      />

      <ConfirmDialog
        open={!!releaseTarget}
        onOpenChange={(o) => !o && setReleaseTarget(null)}
        title="שחרור פרס"
        destructive={false}
        confirmLabel="שחרר את הפרס"
        description={
          <span className="block space-y-2 text-start">
            <span className="block">
              הפעולה תבטל את <b>כל</b> המימושים הפעילים של{" "}
              <b>"{releaseTarget?.name ?? "הפרס"}"</b> אצל השותף, תחזיר לו את המטבעות שהוצאו,
              ותפתח את הפרס מחדש כך שיוכל לממש אותו שוב.
            </span>
            <span className="block rounded-lg bg-muted p-2.5 text-xs">
              <b className="block text-foreground">מתי להשתמש בזה:</b>
              <span className="mt-1 block text-muted-foreground">
                • השותף קנה את אותו פרס פעמיים בטעות (או באג), לניקוי והחזר.
              </span>
              <span className="block text-muted-foreground">
                • רוצים לתת לשותף לממש שוב פרס חד-פעמי שכבר נוצל.
              </span>
              <span className="block text-muted-foreground">
                • לאפס מוקדם תקופת המתנה של פרס, כדי שיוכל לממש כבר עכשיו.
              </span>
            </span>
            <span className="block text-xs text-muted-foreground">
              <b>ההבדל מ"לא אושר":</b> "לא אושר" מבטל מימוש <b>בודד</b> (דחיית בקשה שממתינה)
              ומחזיר מטבעות. "שחרר פרס" עושה את אותו דבר על <b>כל</b> המימושים של הפרס יחד.
            </span>
          </span>
        }
        onConfirm={() => releaseTarget && releaseReward(releaseTarget.id, releaseTarget.name)}
      />
    </div>
  );
}

/** Close an EXISTING lead as won: captures deal value + commission + payment.
 *  Setting status='closed' fires the +20 partner-coins trigger automatically. */
function CloseLeadDialog({
  lead,
  partnerId,
  onClose,
}: {
  lead: { id: string; name: string } | null;
  partnerId: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [saving, setSaving] = useState(false);
  const [seeded, setSeeded] = useState<string | null>(null);
  const [form, setForm] = useState({
    deal_value: "",
    commission_amount: "",
    payment_method: "bank_transfer" as "bit" | "bank_transfer",
    paid: false,
    payment_date: new Date().toISOString().slice(0, 10),
  });

  if (lead && lead.id !== seeded) {
    setForm({
      deal_value: "",
      commission_amount: "",
      payment_method: "bank_transfer",
      paid: false,
      payment_date: new Date().toISOString().slice(0, 10),
    });
    setSeeded(lead.id);
  }

  async function save() {
    if (!lead) return;
    const deal = Number(form.deal_value);
    if (Number.isNaN(deal) || deal <= 0) return toastError("צריך ערך עסקה.");
    const commission = form.commission_amount.trim() ? Number(form.commission_amount) : null;
    if (commission != null && (Number.isNaN(commission) || commission < 0))
      return toastError("סכום עמלה לא תקין.");
    setSaving(true);
    const { error } = await supabase
      .from("partner_leads")
      .update({
        status: "closed",
        deal_value: deal,
        commission_rate_at_close:
          commission != null && deal > 0 ? Math.round((commission / deal) * 10000) / 100 : null,
        commission_amount: commission,
        payment_method: form.paid ? form.payment_method : null,
        payment_confirmed_at: form.paid ? new Date(form.payment_date).toISOString() : null,
        payment_confirmed_by: form.paid ? user?.id ?? null : null,
      })
      .eq("id", lead.id);
    setSaving(false);
    if (error) return toastError("סגירת העסקה נכשלה.");
    toast({ title: "העסקה נסגרה ✓", variant: "success" });
    qc.invalidateQueries({ queryKey: ["partner-detail", partnerId] });
    onClose();
  }

  return (
    <Dialog open={!!lead} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>סגירת עסקה</DialogTitle>
          <DialogDescription>{lead?.name}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>ערך העסקה (₪)</Label>
              <Input dir="ltr" type="number" min="0" value={form.deal_value}
                onChange={(e) => setForm((f) => ({ ...f, deal_value: e.target.value }))} placeholder="₪" />
            </div>
            <div className="space-y-1.5">
              <Label>עמלה לשותף (₪)</Label>
              <Input dir="ltr" type="number" min="0" value={form.commission_amount}
                onChange={(e) => setForm((f) => ({ ...f, commission_amount: e.target.value }))} placeholder="₪" />
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input type="checkbox" checked={form.paid}
              onChange={(e) => setForm((f) => ({ ...f, paid: e.target.checked }))}
              className="size-4 accent-[var(--primary)]" />
            העמלה כבר שולמה
          </label>
          {form.paid && (
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label>אמצעי תשלום</Label>
                <SelectMenu variant="field" ariaLabel="אמצעי תשלום" value={form.payment_method}
                  onChange={(v) => setForm((f) => ({ ...f, payment_method: v as "bit" | "bank_transfer" }))}
                  options={[{ value: "bank_transfer", label: "העברה בנקאית" }, { value: "bit", label: "ביט" }]} />
              </div>
              <div className="space-y-1.5">
                <Label>תאריך תשלום</Label>
                <Input type="date" value={form.payment_date}
                  onChange={(e) => setForm((f) => ({ ...f, payment_date: e.target.value }))} />
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">סגירת העסקה מזכה את השותף ב-20 מטבעות אוטומטית.</p>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving}>{saving ? "שומר…" : "סגירת עסקה"}</Button>
          <Button variant="ghost" onClick={onClose}>ביטול</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
              placeholder="למשל: אתר תדמית, חברת X"
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
