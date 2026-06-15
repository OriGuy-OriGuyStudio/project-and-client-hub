/** Whether a store reward can be redeemed now, or why not (mirrors the redeem RPCs). */
export type RewardAvailability = { ok: boolean; label?: string };

type RedemptionLike = { reward_id: string; status: string; fulfilled_at: string | null };

export function rewardAvailability(
  reward: { id: string; kind?: string | null; cooldown_days: number | null },
  redemptions: RedemptionLike[],
  opts?: { boostActive?: boolean }
): RewardAvailability {
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
