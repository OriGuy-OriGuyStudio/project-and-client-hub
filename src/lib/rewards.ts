/** Whether a store reward can be redeemed now, or why not (mirrors the redeem RPCs). */
export type RewardAvailability = { ok: boolean; label?: string };

/** Derived ₪ value of a monetary reward: cost × coin-value × gift-value-%. */
export function monetaryValue(cost: number, ilsPerCoin: number, giftValuePct: number): number {
  return Math.round(cost * ilsPerCoin * (giftValuePct / 100));
}

type RedemptionLike = { reward_id: string; status: string; fulfilled_at: string | null };

export function rewardAvailability(
  reward: {
    id: string;
    kind?: string | null;
    cooldown_days: number | null;
    available_from?: string | null;
    available_until?: string | null;
    stock_left?: number | null;
  },
  redemptions: RedemptionLike[],
  opts?: { boostActive?: boolean }
): RewardAvailability {
  // Availability window (mirrors assert_reward_purchasable).
  const now = Date.now();
  if (reward.available_from && now < new Date(reward.available_from).getTime()) {
    return { ok: false, label: "בקרוב" };
  }
  if (reward.available_until && now > new Date(reward.available_until).getTime()) {
    return { ok: false, label: "הסתיים" };
  }
  if (reward.stock_left != null && reward.stock_left <= 0) {
    return { ok: false, label: "אזל" };
  }
  if (reward.kind === "commission_boost" && opts?.boostActive) {
    return { ok: false, label: "בוסט פעיל" };
  }
  const mine = redemptions.filter((r) => r.reward_id === reward.id);
  if (mine.some((r) => r.status === "pending")) {
    return { ok: false, label: "ממתין לאישור" };
  }
  const fulfilled = mine.filter((r) => r.status === "fulfilled");
  if (reward.cooldown_days == null) {
    if (fulfilled.length > 0) return { ok: false, label: "כבר מומש" };
  } else if (reward.cooldown_days > 0) {
    const ms = reward.cooldown_days * 86_400_000;
    const latest = fulfilled
      .map((r) => (r.fulfilled_at ? new Date(r.fulfilled_at).getTime() : 0))
      .sort((a, b) => b - a)[0];
    if (latest && Date.now() - latest < ms) {
      const daysLeft = Math.ceil((latest + ms - Date.now()) / 86_400_000);
      return { ok: false, label: `זמין בעוד ${daysLeft} ימים` };
    }
  }
  return { ok: true };
}
