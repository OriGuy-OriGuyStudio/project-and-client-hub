import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Coins, TrendingUp, Gift, BadgePercent, Sparkles, Zap } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { usePartner } from "@/hooks/usePartner";
import { supabase } from "@/lib/supabase";
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
  cancelled: "בוטל",
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

  const currentIdx = TIERS.reduce((acc, t, i) => (closed >= t.at ? i : acc), 0);
  const current = TIERS[currentIdx];
  const next = TIERS[currentIdx + 1];
  const progress = next
    ? Math.min(100, Math.round(((closed - current.at) / (next.at - current.at)) * 100))
    : 100;

  const redeem = useMutation({
    mutationFn: async (rewardId: string) => {
      const { error } = await supabase.rpc("redeem_partner_reward", { p_reward_id: rewardId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partner-me"] });
      toast({ title: "הפרס מומש! נטפל בו בקרוב 🎉", variant: "success" });
    },
    onError: (e: unknown) =>
      toastError((e as { message?: string })?.message || "המימוש נכשל."),
  });

  return (
    <div className="space-y-6">
      {/* Coins + tier */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="relative overflow-hidden p-5">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Coins className="size-4 text-primary" />
            <span className="text-sm">המטבעות שלי</span>
          </div>
          <p className="mt-2 font-heading text-4xl font-black text-foreground">
            {coins.toLocaleString("he-IL")}
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
      <div>
        <h2 className="mb-3 flex items-center gap-2 font-heading text-lg font-bold text-foreground">
          <Gift className="size-5 text-primary" /> החנות
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rewards.map((r) => {
            const affordable = coins >= r.credit_cost;
            const Icon = r.kind === "commission_boost" ? BadgePercent : r.kind === "payout" ? Coins : Sparkles;
            return (
              <Card key={r.id} className="flex flex-col p-5">
                <div className="flex items-center gap-2 text-primary">
                  <Icon className="size-5" />
                  <span className="font-heading text-sm font-bold text-foreground">{r.name}</span>
                </div>
                {r.description && (
                  <p className="mt-2 flex-1 text-xs leading-relaxed text-muted-foreground">
                    {r.description}
                  </p>
                )}
                <div className="mt-4 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 font-heading text-sm font-bold text-foreground">
                    <Coins className="size-4 text-primary" /> {r.credit_cost}
                  </span>
                  <Button
                    size="sm"
                    disabled={!affordable || redeem.isPending}
                    onClick={() => setConfirm(r)}
                  >
                    {affordable ? "מימוש" : "אין מספיק"}
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* History */}
      {redemptions.length > 0 && (
        <div>
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
          if (confirm) redeem.mutate(confirm.id);
          setConfirm(null);
        }}
      />
    </div>
  );
}
