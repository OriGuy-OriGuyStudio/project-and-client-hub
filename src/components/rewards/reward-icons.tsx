import {
  BadgePercent,
  Camera,
  Coins,
  Crown,
  Diamond,
  Gift,
  HeartHandshake,
  Megaphone,
  Palette,
  PartyPopper,
  Percent,
  Rocket,
  ShoppingBag,
  Sparkles,
  Star,
  Telescope,
  Ticket,
  TrendingUp,
  Trophy,
  Wand2,
  type LucideIcon,
} from "lucide-react";
import type { Reward } from "@/types/database";

/** Curated, on-brand monochrome icon set (keys stored in rewards.icon). */
export const REWARD_ICONS: Record<string, LucideIcon> = {
  gift: Gift,
  diamond: Diamond,
  trophy: Trophy,
  crown: Crown,
  ticket: Ticket,
  coins: Coins,
  percent: Percent,
  badge: BadgePercent,
  rocket: Rocket,
  sparkles: Sparkles,
  trending: TrendingUp,
  palette: Palette,
  handshake: HeartHandshake,
  telescope: Telescope,
  bag: ShoppingBag,
  megaphone: Megaphone,
  camera: Camera,
  party: PartyPopper,
  wand: Wand2,
  star: Star,
};

export const REWARD_ICON_KEYS = Object.keys(REWARD_ICONS);

/** Resolve a reward's icon: explicit key → fallback by kind. */
export function rewardIconFor(reward: Pick<Reward, "icon" | "kind">): LucideIcon {
  if (reward.icon && REWARD_ICONS[reward.icon]) return REWARD_ICONS[reward.icon];
  return reward.kind === "commission_boost"
    ? BadgePercent
    : reward.kind === "payout"
      ? Coins
      : Gift;
}
