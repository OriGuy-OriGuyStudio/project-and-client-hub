import { Clock, Coins, Flame, Gift, Sparkles, Star } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { rewardAvailability, monetaryValue, type RewardAvailability } from "@/lib/rewards";
import { rewardIconFor } from "@/components/rewards/reward-icons";
import { useAuth } from "@/hooks/useAuth";
import { gendered } from "@/lib/gender";
import type { Reward } from "@/types/database";

type RedemptionLike = { reward_id: string; status: string; fulfilled_at: string | null };

/** Premium reward card — shared by the client and partner stores. */
export function RewardStoreCard({
  reward,
  balance,
  currencyLabel,
  avail,
  redeeming,
  ilsPerCoin = 1,
  giftValuePct = 75,
  onRedeem,
}: {
  reward: Reward;
  balance: number;
  currencyLabel: string;
  avail: RewardAvailability;
  redeeming: boolean;
  ilsPerCoin?: number;
  giftValuePct?: number;
  onRedeem: () => void;
}) {
  const { profile } = useAuth();
  const affordable = balance >= reward.credit_cost;
  const pct = Math.min(100, Math.round((balance / Math.max(reward.credit_cost, 1)) * 100));
  const remaining = Math.max(0, reward.credit_cost - balance);
  const Icon = rewardIconFor(reward);
  const lowStock = reward.stock_left != null && reward.stock_left > 0 && reward.stock_left <= 3;
  const endsAt = reward.available_until ? new Date(reward.available_until) : null;
  const cashValue = reward.is_monetary
    ? monetaryValue(reward.credit_cost, ilsPerCoin, giftValuePct)
    : 0;

  return (
    <Card
      dir="rtl"
      className={
        "relative flex flex-col gap-3 overflow-hidden p-5 text-start transition " +
        (reward.is_featured ? "reward-featured bg-primary/[0.07]" : "")
      }
    >
      {reward.is_featured && (
        <span className="absolute end-3 top-3 z-10 inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[11px] font-bold text-primary-foreground">
          <Star className="size-3" /> מודגש
        </span>
      )}

      {/* Header: icon + title on one aligned line */}
      <div className={"flex items-center gap-2.5" + (reward.is_featured ? " pe-20" : "")}>
        <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
          <Icon className="size-[22px]" />
        </div>
        <p className="min-w-0 flex-1 truncate font-heading text-[15px] font-bold leading-tight text-foreground">
          {reward.name}
        </p>
      </div>

      {(cashValue > 0 || lowStock || endsAt) && (
        <div className="flex flex-wrap items-center gap-2">
          {cashValue > 0 && (
            <span className="inline-flex items-center rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
              שווי ₪{cashValue.toLocaleString("he-IL")}
            </span>
          )}
          {lowStock && (
            <span className="inline-flex animate-pulse items-center gap-1 rounded-full bg-destructive/15 px-2.5 py-1 text-[11px] font-bold text-destructive">
              <Flame className="size-3.5" /> מהר! נשארו רק {reward.stock_left}
            </span>
          )}
          {endsAt && (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
              <Clock className="size-3" /> עד{" "}
              {endsAt.toLocaleDateString("he-IL", { day: "numeric", month: "numeric" })}
            </span>
          )}
        </div>
      )}

      {reward.description && (
        <p className="flex-1 text-xs leading-relaxed text-muted-foreground">{reward.description}</p>
      )}

      {/* Motivation: progress + a prominent status line (RTL fills from the right) */}
      <div className="space-y-2">
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className={"h-full rounded-full transition-all " + (affordable ? "bg-primary" : "bg-primary/60")}
            style={{ width: `${pct}%` }}
          />
        </div>
        {!avail.ok ? (
          <p className="text-xs font-medium text-muted-foreground">{avail.label}</p>
        ) : affordable ? (
          <p className="inline-flex items-center gap-1.5 rounded-lg bg-primary/12 px-2.5 py-1.5 text-xs font-bold text-primary">
            <Sparkles className="size-3.5" /> אפשר לממש עכשיו 🎉
          </p>
        ) : (
          <p className="text-xs text-foreground">
            עוד <span className="font-heading text-sm font-black text-primary">{remaining}</span>{" "}
            {currencyLabel} ו{gendered(profile?.gender, "אתה משחרר", "את משחררת")} את זה
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-border/60 pt-3">
        <span className="inline-flex items-center gap-1.5 font-heading text-lg font-black text-foreground">
          <Coins className="size-4 text-primary" /> {reward.credit_cost}
        </span>
        <Button size="sm" disabled={!avail.ok || !affordable || redeeming} onClick={onRedeem}>
          {redeeming ? "מממש…" : !avail.ok ? avail.label : affordable ? "מימוש" : "עדיין אוספים"}
        </Button>
      </div>
    </Card>
  );
}

/** "You're almost there" banner — nudges toward the cheapest not-yet-affordable reward. */
export function NextRewardNudge({
  rewards,
  balance,
  redemptions,
  currencyLabel,
  boostActive,
}: {
  rewards: Reward[];
  balance: number;
  redemptions: RedemptionLike[];
  currencyLabel: string;
  boostActive?: boolean;
}) {
  const { profile } = useAuth();
  const target = rewards
    .filter((r) => {
      const a = rewardAvailability(r, redemptions, { boostActive });
      return a.ok && r.credit_cost > balance;
    })
    .sort((a, b) => a.credit_cost - b.credit_cost)[0];

  if (!target) return null;
  const remaining = target.credit_cost - balance;
  const pct = Math.min(100, Math.round((balance / target.credit_cost) * 100));
  const Icon = rewardIconFor(target);

  return (
    <Card dir="rtl" className="flex items-center gap-4 border-primary/30 bg-primary/[0.06] p-4 text-start">
      <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
        <Icon className="size-6" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-foreground">
          עוד <span className="font-bold text-primary">{remaining}</span> {currencyLabel} ו{gendered(profile?.gender, "אתה משחרר", "את משחררת")}
          את <span className="font-semibold">{target.name}</span>
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </Card>
  );
}

const REASON_LABEL: Record<string, string> = {
  referral_submitted: "הפניה הוגשה",
  lead_submitted: "ליד הוגש",
  deal_closed: "עסקה נסגרה",
  reward_redeemed: "מימוש פרס",
  manual_adjustment: "התאמה",
  gift: "מתנה",
  compensation: "פיצוי",
  easter_egg: "הפתעה נסתרת 🔭",
};

/** A coin/credit ledger timeline. */
export function CoinTimeline({
  entries,
  currencyLabel,
  title = "היסטוריית המטבעות",
}: {
  entries: { id: string; amount: number; reason: string | null; note: string | null; created_at: string }[];
  currencyLabel: string;
  title?: string;
}) {
  if (!entries.length) return null;
  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 font-heading text-lg font-bold text-foreground">
        <Gift className="size-5 text-primary" /> {title}
      </h2>
      <Card className="p-2">
        <ol className="relative">
          {entries.map((e, i) => {
            const positive = e.amount >= 0;
            const label = (e.reason && REASON_LABEL[e.reason]) || e.note || "עדכון";
            return (
              <li
                key={e.id}
                className={
                  "flex items-center gap-3 px-3 py-2.5" +
                  (i < entries.length - 1 ? " border-b border-border/60" : "")
                }
              >
                <span
                  className={
                    "grid size-8 shrink-0 place-items-center rounded-full " +
                    (positive ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")
                  }
                >
                  {positive ? <Sparkles className="size-4" /> : <Star className="size-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(e.created_at).toLocaleDateString("he-IL")}
                  </p>
                </div>
                <span
                  className={
                    "font-heading text-sm font-bold " +
                    (positive ? "text-primary" : "text-muted-foreground")
                  }
                >
                  {positive ? "+" : ""}
                  {e.amount} {currencyLabel}
                </span>
              </li>
            );
          })}
        </ol>
      </Card>
    </div>
  );
}
