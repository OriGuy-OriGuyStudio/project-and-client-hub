// Shared, reusable form validators. Use these everywhere so every form in the
// app validates consistently (no field accepts garbage).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A valid email address. */
export function isEmail(v: string): boolean {
  return EMAIL_RE.test(v.trim());
}

/**
 * A plausible phone number: only digits and the usual separators (+ - ( ) space),
 * with 7–15 actual digits. Catches "letters in the phone" and obvious junk.
 */
export function isPhone(v: string): boolean {
  const s = v.trim();
  if (!/^[\d\s+()-]+$/.test(s)) return false;
  const digits = s.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15;
}

/** Non-empty after trimming. */
export function isFilled(v: string): boolean {
  return v.trim().length > 0;
}

/** A http(s) URL. */
export function isUrl(v: string): boolean {
  try {
    const u = new URL(v.trim());
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}
