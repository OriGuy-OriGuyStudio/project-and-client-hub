import type { Gender } from "@/types/database";

/**
 * Pick gendered Hebrew copy. Masculine is the fallback for unset / "other",
 * matching the studio's existing convention.
 *
 *   gendered(profile?.gender, "מוזמן", "מוזמנת")
 */
export function gendered(
  gender: Gender | null | undefined,
  male: string,
  female: string
): string {
  return gender === "female" ? female : male;
}

/**
 * Render gender tokens inside admin-authored text (reward names/descriptions
 * etc.). The admin writes `{form-for-male|form-for-female}`; this picks the right
 * side. Masculine is the fallback. Text without tokens is returned as-is.
 *
 *   applyGender("אורי ו{אתה תורם|את תורמת} לעמותה", "female")  // "אורי ואת תורמת לעמותה"
 */
export function applyGender(text: string | null | undefined, gender: Gender | null | undefined): string {
  if (!text) return "";
  const female = gender === "female";
  return text.replace(/\{([^{}|]*)\|([^{}]*)\}/g, (_m, male, fem) => (female ? fem : male));
}

/** Options for a gender <SelectMenu> in the admin (blank = not specified). */
export const GENDER_OPTIONS: { value: "" | Gender; label: string }[] = [
  { value: "", label: "לא צוין" },
  { value: "male", label: "זכר" },
  { value: "female", label: "נקבה" },
];
