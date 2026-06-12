import {
  Facebook,
  Globe,
  Instagram,
  Linkedin,
  type LucideIcon,
  MessageCircle,
  Music2,
  Send,
  Twitter,
  Youtube,
} from "lucide-react";

/** One social entry. Stored as an array in `client_brand.social_links` (jsonb),
 *  so the same platform can appear more than once. */
export type SocialLink = { platform: string; url: string };

/** Known platforms, in pick-order. `website` doubles as the "other/custom" slot. */
export const SOCIAL_PLATFORMS: { key: string; label: string; Icon: LucideIcon }[] = [
  { key: "instagram", label: "אינסטגרם", Icon: Instagram },
  { key: "facebook", label: "פייסבוק", Icon: Facebook },
  { key: "linkedin", label: "לינקדאין", Icon: Linkedin },
  { key: "tiktok", label: "טיקטוק", Icon: Music2 },
  { key: "youtube", label: "יוטיוב", Icon: Youtube },
  { key: "twitter", label: "X / טוויטר", Icon: Twitter },
  { key: "whatsapp", label: "וואטסאפ", Icon: MessageCircle },
  { key: "telegram", label: "טלגרם", Icon: Send },
  { key: "website", label: "אתר / אחר", Icon: Globe },
];

const BY_KEY = new Map(SOCIAL_PLATFORMS.map((p) => [p.key, p]));

export function iconForPlatform(platform: string): LucideIcon {
  return BY_KEY.get(platform)?.Icon ?? Globe;
}
export function labelForPlatform(platform: string): string {
  return BY_KEY.get(platform)?.label ?? platform;
}

/** Tolerant reader: accepts the new array shape, the legacy `{key: url}` object,
 *  or null — always returns a clean array (empty urls dropped). */
export function normalizeSocialLinks(raw: unknown): SocialLink[] {
  if (Array.isArray(raw)) {
    return raw
      .filter(
        (e): e is SocialLink =>
          !!e && typeof e === "object" && typeof (e as SocialLink).url === "string"
      )
      .map((e) => ({ platform: e.platform || "website", url: e.url }))
      .filter((e) => e.url.trim().length > 0);
  }
  if (raw && typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>)
      .filter(([, v]) => typeof v === "string" && (v as string).trim().length > 0)
      .map(([platform, v]) => ({ platform, url: v as string }));
  }
  return [];
}
