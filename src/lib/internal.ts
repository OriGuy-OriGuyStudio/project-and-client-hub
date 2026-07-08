// The studio's own "client" — internal work (Orion, Pixel chat, admin), not a
// paying client. Flagged so the timer reports and the admin clients list keep
// it in its own section (no ₪/hour, never counted as revenue).
// ⚠️ Keep in sync with the provisioned studio account's email.
export const INTERNAL_CLIENT_EMAILS = new Set<string>(["studio@origuystudio.com"]);

export function isInternalClient(email: string | null | undefined): boolean {
  return !!email && INTERNAL_CLIENT_EMAILS.has(email.trim().toLowerCase());
}
