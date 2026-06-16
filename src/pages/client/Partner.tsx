import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Coins, Gift, Lock, Pencil, Send, Trash2, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionNav } from "@/components/layout/SectionNav";
import { startClientStoreTour, whenUiIsClear } from "@/components/help/tour";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { AnimatedNumber } from "@/components/ui/animated-number";
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
import { useClientPartner } from "@/hooks/useClientPartner";
import { clampText } from "@/lib/sanitize";
import { celebrate, celebrateBig } from "@/lib/confetti";
import { rewardAvailability } from "@/lib/rewards";
import { RewardStoreCard, NextRewardNudge, CoinTimeline } from "@/components/rewards/StoreUI";
import { notifyAdminTask } from "@/lib/invite";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { referralStatusHe, referralStatusVariant } from "@/lib/status";
import type { Referral } from "@/types/database";

export default function Partner() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const reduced = usePrefersReducedMotion();
  const { data, isLoading } = useClientPartner();
  const [form, setForm] = useState({ name: "", contact: "", note: "" });
  const [sending, setSending] = useState(false);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [coinBurst, setCoinBurst] = useState(0);
  const [editTarget, setEditTarget] = useState<Referral | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Referral | null>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: ["client-partner"] });

  async function submitReferral() {
    const name = clampText(form.name.trim(), 120);
    const contact = clampText(form.contact.trim(), 160);
    if (!name || !contact) return toastError("צריך שם ופרטי יצירת קשר.");
    setSending(true);
    const { error } = await supabase.from("referrals").insert({
      referrer_id: user!.id,
      referred_name: name,
      referred_contact: contact,
      note: clampText(form.note.trim(), 2000) || null,
    });
    setSending(false);
    if (error) return toastError("שליחת ההפניה נכשלה.");
    celebrate();
    setCoinBurst((k) => k + 1);
    toast({ title: "ההפניה נשלחה, קיבלת קרדיט 🎉", variant: "success" });
    setForm({ name: "", contact: "", note: "" });
    refresh();
  }

  async function redeem(rewardId: string, cost: number, rewardName?: string, featured?: boolean) {
    if ((data?.credits ?? 0) < cost) return toastError("אין מספיק קרדיטים.");
    setRedeeming(rewardId);
    const { error } = await supabase.rpc("redeem_reward", { p_reward_id: rewardId });
    setRedeeming(null);
    if (error) return toastError(error.message || "המימוש נכשל.");
    if (featured) celebrateBig();
    else celebrate();
    toast({ title: "הבקשה נשלחה, ממתינה לאישור 🎁", variant: "success" });
    void notifyAdminTask("מימוש חדש בחנות (לקוח)", rewardName || "");
    refresh();
  }

  const credits = data?.credits ?? 0;
  const enrolled = !!data?.enrollment;

  // First visit to the rewards-store page → its own short tour (gated on the
  // loader/popups clearing). The dashboard tour only points here via the nav.
  useEffect(() => {
    if (isLoading || !user?.id || !enrolled) return;
    const key = `sog-store-tour-${user.id}`;
    if (localStorage.getItem(key)) return;
    return whenUiIsClear(() => {
      startClientStoreTour();
      localStorage.setItem(key, "1");
    });
  }, [isLoading, user?.id, enrolled]);

  if (!isLoading && !enrolled) {
    return (
      <div>
        <PageHeader title="תוכנית השותפים" />
        <EmptyState
          icon={Lock}
          title="התוכנית עדיין לא נפתחה עבורך"
          description="תוכנית השותפים נפתחת אחרי שנסגור יחד את התנאים. דבר איתי ואשמח לצרף אותך."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="תוכנית השותפים"
        subtitle="הפנה עסקים לסטודיו, צבור קרדיטים, וממש אותם על פרסים."
      />

      <SectionNav />

      {/* Credits with coin burst (no overflow-hidden so coins can fly out) */}
      <Card data-tour="store-credits" className="relative flex items-center justify-between gap-4 p-6">
        <div className="flex items-center gap-3">
          <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <Coins className="size-6" />
          </span>
          <div>
            <p className="text-sm text-muted-foreground">סך הקרדיטים שלך</p>
            <p className="font-heading text-3xl font-black text-foreground">
              {isLoading ? "…" : <AnimatedNumber value={credits} />}
            </p>
          </div>
        </div>
        <p className="hidden max-w-xs text-sm text-muted-foreground sm:block">
          כל הפניה מזכה אותך בקרדיט. עסקה שנסגרת מזכה ב-5 קרדיטים ובאחוז מערך
          העסקה.
        </p>
        <CoinBurst trigger={coinBurst} disabled={reduced} />
      </Card>

      {/* Submit referral — full-width form */}
      <section data-tour="store-referral" data-section="הגשת הפניה" className="scroll-mt-20">
        <Card className="space-y-4 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Send className="size-5 text-brand-cyan-base" />
            <h2 className="font-heading text-lg font-semibold text-foreground">
              הגשת הפניה
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="r-name">שם המופנה</Label>
              <Input id="r-name" value={form.name} maxLength={120}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="r-contact">טלפון או מייל</Label>
              <Input id="r-contact" dir="ltr" value={form.contact} maxLength={160}
                onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="r-note">הערה</Label>
            <Textarea id="r-note" value={form.note} maxLength={2000}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
          </div>
          <Button className="w-full sm:w-auto" onClick={submitReferral} disabled={sending}>
            {sending ? "שולח…" : "שליחה (קרדיט אחד מיידי)"}
          </Button>
        </Card>
      </section>

      {/* Rewards store — grid below the form */}
      <section data-tour="store-rewards" data-section="חנות הפרסים" className="scroll-mt-20 space-y-4">
        <div className="flex items-center gap-2">
          <Gift className="size-5 text-brand-cyan-base" />
          <h2 className="font-heading text-lg font-semibold text-foreground">חנות הפרסים</h2>
        </div>
        {isLoading ? (
          <Skeleton className="h-24 w-full rounded-xl" />
        ) : !data?.rewards.length ? (
          <EmptyState icon={Gift} title="אין עדיין פרסים" />
        ) : (
          <>
            <NextRewardNudge
              rewards={data.rewards}
              balance={credits}
              redemptions={data.redemptions ?? []}
              currencyLabel="קרדיטים"
            />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.rewards.map((r) => (
                <RewardStoreCard
                  key={r.id}
                  reward={r}
                  balance={credits}
                  currencyLabel="קרדיטים"
                  ilsPerCoin={data.ilsPerCoin}
                  giftValuePct={data.giftValuePct}
                  avail={rewardAvailability(r, data.redemptions ?? [])}
                  redeeming={redeeming === r.id}
                  onRedeem={() => redeem(r.id, r.credit_cost, r.name, r.is_featured)}
                />
              ))}
            </div>
          </>
        )}
        <p className="text-center text-xs text-muted-foreground">
          ✨ עוד פרסים יתווספו לחנות בהמשך
        </p>
      </section>

      {/* Referrals list */}
      <div data-tour="store-referrals" data-section="ההפניות שלך" className="scroll-mt-20">
        <h2 className="mb-3 font-heading text-lg font-bold text-foreground">ההפניות שלך</h2>
        {isLoading ? (
          <Skeleton className="h-20 w-full rounded-2xl" />
        ) : !data?.referrals.length ? (
          <EmptyState
            icon={Users}
            title="עוד לא הגשת הפניות"
            description="כל עסק שתפנה יופיע כאן עם הסטטוס."
          />
        ) : (
          <div className="space-y-2">
            {data.referrals.map((r) => (
              <Card key={r.id} className="flex items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{r.referred_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("he-IL")}
                    {r.deal_value ? ` · עסקה ₪${r.deal_value.toLocaleString("he-IL")}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Badge variant={referralStatusVariant[r.status]}>
                    {referralStatusHe[r.status]}
                  </Badge>
                  {r.status === "submitted" && (
                    <>
                      <Button variant="ghost" size="icon" aria-label="עריכה" onClick={() => setEditTarget(r)}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        aria-label="מחיקה"
                        onClick={() => setDeleteTarget(r)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Credit history */}
      {data?.ledger && data.ledger.length > 0 && (
        <div data-tour="store-history" data-section="היסטוריית הקרדיטים" className="scroll-mt-20">
          <CoinTimeline entries={data.ledger} currencyLabel="קרדיטים" title="היסטוריית הקרדיטים" />
        </div>
      )}

      <EditReferralDialog target={editTarget} onClose={() => setEditTarget(null)} onSaved={refresh} />
      <DeleteReferralDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} onSaved={refresh} />
    </div>
  );
}

function CoinBurst({ trigger, disabled }: { trigger: number; disabled: boolean }) {
  if (disabled || trigger === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-0">
      {Array.from({ length: 7 }).map((_, i) => (
        <motion.span
          key={`${trigger}-${i}`}
          initial={{ opacity: 0, y: 10, scale: 0.5 }}
          animate={{ opacity: [0, 1, 1, 0], y: -70 - Math.random() * 40, scale: 1 }}
          transition={{ duration: 1, delay: i * 0.05, ease: "easeOut" }}
          className="absolute end-8 top-8 text-2xl"
          style={{ insetInlineEnd: `${24 + (i - 3) * 18}px` }}
        >
          🪙
        </motion.span>
      ))}
    </div>
  );
}

function EditReferralDialog({
  target,
  onClose,
  onSaved,
}: {
  target: Referral | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [saving, setSaving] = useState(false);
  const [seeded, setSeeded] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", contact: "", note: "" });

  if (target && target.id !== seeded) {
    setForm({
      name: target.referred_name,
      contact: target.referred_contact,
      note: target.note ?? "",
    });
    setSeeded(target.id);
  }

  async function save() {
    if (!target) return;
    const name = clampText(form.name.trim(), 120);
    const contact = clampText(form.contact.trim(), 160);
    if (!name || !contact) return toastError("צריך שם ופרטי יצירת קשר.");
    setSaving(true);
    const { error } = await supabase
      .from("referrals")
      .update({ referred_name: name, referred_contact: contact, note: clampText(form.note.trim(), 2000) || null })
      .eq("id", target.id);
    setSaving(false);
    if (error) return toastError("העדכון נכשל.");
    toast({ title: "ההפניה עודכנה", variant: "success" });
    onSaved();
    onClose();
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>עריכת הפניה</DialogTitle>
          <DialogDescription>אפשר לערוך כל עוד ההפניה בסטטוס "הוגשה".</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="er-name">שם המופנה</Label>
            <Input id="er-name" value={form.name} maxLength={120}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="er-contact">טלפון או מייל</Label>
            <Input id="er-contact" dir="ltr" value={form.contact} maxLength={160}
              onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="er-note">הערה</Label>
            <Textarea id="er-note" value={form.note} maxLength={2000}
              onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={save} disabled={saving}>{saving ? "שומר…" : "שמירה"}</Button>
          <Button variant="ghost" onClick={onClose}>ביטול</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteReferralDialog({
  target,
  onClose,
  onSaved,
}: {
  target: Referral | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  async function confirm() {
    if (!target) return;
    setBusy(true);
    const { error } = await supabase.from("referrals").delete().eq("id", target.id);
    setBusy(false);
    if (error) return toastError("המחיקה נכשלה.");
    toast({ title: "ההפניה נמחקה", variant: "success" });
    onSaved();
    onClose();
  }
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>מחיקת הפניה</DialogTitle>
          <DialogDescription>
            ההפניה "{target?.referred_name}" תימחק, והקרדיט שקיבלת עליה יבוטל.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="destructive" onClick={confirm} disabled={busy}>
            <Trash2 className="size-4" /> {busy ? "מוחק…" : "מחיקה"}
          </Button>
          <Button variant="ghost" onClick={onClose}>ביטול</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
