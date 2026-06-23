// Ori's own test accounts. They're real whitelisted users (so he can log in and
// click around), but the admin UI groups them into a separate "טסטים (דמה)"
// section so they never mix with real clients/partners.
export const DEMO_EMAILS = new Set<string>([
  "origuydev@gmail.com",
  "origuy2018@gmail.com",
]);

export function isDemoEmail(email: string | null | undefined): boolean {
  return !!email && DEMO_EMAILS.has(email.trim().toLowerCase());
}
