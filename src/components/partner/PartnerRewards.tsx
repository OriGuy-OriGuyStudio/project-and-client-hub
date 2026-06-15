import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Coins, TrendingUp, Gift, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { RewardStoreCard, NextRewardNudge, CoinTimeline } from "@/components/rewards/StoreUI";
import { usePartner } from "@/hooks/usePartner";
import { supabase } from "@/lib/supabase";
import { celebrate, celebrateBig } from "@/lib/confetti";
import { rewardAvailability } from "@/lib/rewards";
import { notifyAdminTask } from "@/lib/invite";
import { toast, toastError } from "@/hooks/use-toast";
import type { Reward } from "@/types/database";

const TIERS = [
  { key: "bronze", label: "ברונזה", at: 0, rate: 5 },
  { key: "silver", label: "כסף", at: 3, rate: 6.5 },
  { key: "gold", label: "זהב", at: 7, rate: 8 },
  { key: "platinum", label: "פלטינה", at: 12, rate: 9 },
  { key: "ambassador", label: "שגריר", at: 20, rate: 10 },
] as const;

const REDEMPTION_STATUS: Record<string, string> = {
  pending: "ממתין לטיפול",
  fulfilled: "טופל",
  cancelled: "לא אושר",
};

export function PartnerRewards() {
  const qc = useQueryClient();
  const { data } = usePartner();
  const [confirm, setConfirm] = useState<Reward | null>(null);

  const coins = data?.coins ?? 0;
  const closed = (data?.leads ?? []).filter((l) => l.status === "closed").length;
  const baseRate = data?.profile?.commission_rate ?? 5;
  const boostPct = data?.profile?.boost_pct ?? 0;
  const boostLeft = data?.profile?.boost_deals_left ?? 0;
  const rewards = data?.rewards ?? [];
  const redemptions = data?.redemptions ?? [];
  const coinLedger = data?.coinLedger ?? [];

  const currentIdx = TIERS.reduce((acc, t, i) => (closed >= t.at ? i : acc), 0);
  const current = TIERS[currentIdx];
  const next = TIERS[currentIdx + 1];
  const progress = next
    ? Math.min(100, Math.round(((closed - current.at) / (next.at - current.at)) * 100))
    : 100;

  const redeem = useMutation({
    mutationFn: async (reward: Reward) => {
      const { error } = await supabase.rpc("redeem_partner_reward", { p_reward_id: reward.id });
      if (error) throw error;
      return reward;
    },
    onSuccess: (reward) => {
      qc.invalidateQueries({ queryKey: ["partner-me"] });
      if (reward.is_featured) celebrateBig();
      else celebrate();
      toast({
        title:
          reward.kind === "commission_boost"
            ? "הבוסט הופעל! 🎉"
            : "הבקשה נשלחה, ממתינה לאישור 🎁",
        variant: "success",
      });
      // Boost is auto-applied; everything else needs the admin.
      if (reward.kind !== "commission_boost") {
        void notifyAdminTask("מימוש חדש בחנות (שותף)", reward.name);
      }
    },
    onError: (e: unknown) =>
      toastError((e as { message?: string })?.message || "המימוש נכשל."),
  });

  return (
    <div className="space-y-6">
      {/* Coins + tier */}
      <div data-section="המטבעות שלי" className="scroll-mt-20 grid gap-4 lg:grid-cols-2">
        <Card className="relative overflow-hidden p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Coins className="size-4 text-primary" />
            <span className="text-sm">המטבעות שלי</span>
          </div>
          <p className="mt-2 font-heading text-4xl font-black text-foreground">
            <AnimatedNumber value={coins} />
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            מרוויחים 20 מטבעות על כל עסקה שנסגרת, וממירים אותם בחנות שלמטה.
          </p>
          {boostLeft > 0 && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <Zap className="size-3.5" /> בוסט +{boostPct}% פעיל · נותרו {boostLeft} עסקאות
            </div>
          )}
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="size-4 text-primary" />
              <span className="text-sm">מסלול העמלה שלי</span>
            </div>
            <Badge variant="success">{current.label}</Badge>
          </div>
          <p className="mt-2 font-heading text-2xl font-black text-foreground">
            {(baseRate + boostPct).toLocaleString("he-IL")}% עמלה
            {boostPct > 0 && (
              <span className="ms-2 text-sm font-normal text-primary">(כולל בוסט)</span>
            )}
          </p>
          {/* progress to next tier (RTL: fill from the right) */}
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-background">
            <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {next
              ? `עוד ${Math.max(next.at - closed, 0)} עסקאות שנסגרות למסלול ${next.label} (${next.rate}%)`
              : "הגעת למסלול הגבוה ביותר 👑"}
          </p>
        </Card>
      </div>

      {/* Store */}
      <div data-section className="scroll-mt-20 space-y-4">
        <h2 className="flex items-center gap-2 font-heading text-lg font-bold text-foreground">
          <Gift className="size-5 text-primary" /> החנות
        </h2>
        <NextRewardNudge
          rewards={rewards}
          balance={coins}
          redemptions={redemptions}
          currencyLabel="מטבעות"
          boostActive={boostLeft > 0}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rewards.map((r) => (
            <RewardStoreCard
              key={r.id}
              reward={r}
              balance={coins}
              currencyLabel="מטבעות"
              ilsPerCoin={data?.ilsPerCoin}
              giftValuePct={data?.giftValuePct}
              avail={rewardAvailability(r, redemptions, { boostActive: boostLeft > 0 })}
              redeeming={redeem.isPending}
              onRedeem={() => setConfirm(r)}
            />
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          ✨ עוד פרסים יתווספו לחנות בהמשך
        </p>
      </div>

      {/* Coin history */}
      {coinLedger.length > 0 && (
        <div data-section className="scroll-mt-20">
          <CoinTimeline entries={coinLedger} currencyLabel="מטבעות" />
        </div>
      )}

      {/* Redemptions */}
      {redemptions.length > 0 && (
        <div data-section className="scroll-mt-20">
          <h2 className="mb-3 font-heading text-lg font-bold text-foreground">המימושים שלי</h2>
          <div className="space-y-2">
            {redemptions.map((red) => {
              const reward = rewards.find((r) => r.id === red.reward_id);
              return (
                <Card key={red.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground">
                      {reward?.name ?? "פרס"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(red.created_at).toLocaleDateString("he-IL")} · {red.coins_spent} מטבעות
                    </p>
                  </div>
                  <Badge variant={red.status === "fulfilled" ? "success" : red.status === "cancelled" ? "secondary" : "warning"}>
                    {REDEMPTION_STATUS[red.status] ?? red.status}
                  </Badge>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirm}
        onOpenChange={(o) => !o && setConfirm(null)}
        title={confirm ? `לממש "${confirm.name}"?` : ""}
        description={
          confirm
            ? `זה ינכה ${confirm.credit_cost} מטבעות מהיתרה שלך (${coins}). אטפל בפרס בהקדם.`
            : undefined
        }
        confirmLabel="מימוש"
        destructive={false}
        onConfirm={() => {
          if (confirm) redeem.mutate(confirm);
          setConfirm(null);
        }}
      />
    </div>
  );
}
