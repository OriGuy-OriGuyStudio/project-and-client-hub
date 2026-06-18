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

/** Options for a gender <SelectMenu> in the admin (blank = not specified). */
export const GENDER_OPTIONS: { value: "" | Gender; label: string }[] = [
  { value: "", label: "לא צוין" },
  { value: "male", label: "זכר" },
  { value: "female", label: "נקבה" },
];
