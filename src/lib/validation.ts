// Shared, reusable form validators. Use these everywhere so every form in the
// app validates consistently (no field accepts garbage).

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** A valid email address. */
export function isEmail(v: string): boolean {
  return EMAIL_RE.test(v.trim());
}

/**
 * Normalize an Israeli phone to its local `0XXXXXXXXX` form, or "" if it isn't a
 * valid Israeli number. Accepts separators (-, spaces, parens) and the +972
 * international prefix. Valid = mobile / 07x (10 digits, 0(5X|7[2-9])XXXXXXX) or
 * landline (9 digits, 0[2,3,4,8,9]XXXXXXX).
 */
export function normalizeIsraeliPhone(v: string): string {
  let d = (v ?? "").replace(/\D/g, "");
  if (d.startsWith("972")) d = "0" + d.slice(3);
  if (/^0(5\d|7[2-9])\d{7}$/.test(d)) return d; // mobile / 07x
  if (/^0[23489]\d{7}$/.test(d)) return d; // landline
  return "";
}

/** A valid Israeli phone number (mobile, 07x, or landline; +972 accepted). */
export function isPhone(v: string): boolean {
  return normalizeIsraeliPhone(v) !== "";
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
