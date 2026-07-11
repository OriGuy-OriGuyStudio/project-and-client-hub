import { cn } from "@/lib/utils";

/** The 4 capabilities + manager flag on an organization_members row. Shared
 * shape used by every capability-editing surface (admin member card, admin
 * add-member sheet, manager invite-request sheet, admin approve-invite sheet). */
export type CapValues = {
  isManager: boolean;
  finance: boolean;
  serviceCalls: boolean;
  approve: boolean;
  files: boolean;
};

/** מנהל = is_manager + all 4 caps; צוות = service_calls/approve/files (no finance,
 * no manager); צופה = all false. */
export const CAP_PRESETS: Record<"manager" | "team" | "viewer", CapValues> = {
  manager: { isManager: true, finance: true, serviceCalls: true, approve: true, files: true },
  team: { isManager: false, finance: false, serviceCalls: true, approve: true, files: true },
  viewer: { isManager: false, finance: false, serviceCalls: false, approve: false, files: false },
};

export const CAP_LABELS: Record<keyof CapValues, string> = {
  isManager: "מנהל",
  finance: "כספים",
  serviceCalls: "קריאות שירות",
  approve: "אישור עבודות",
  files: "קבצים",
};

/** A single capability checkbox (checkbox + label), matching the studio's
 * existing checkbox convention (accent-colored native input). */
export function CapCheckbox({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
}) {
  const readOnly = disabled || !onChange;
  return (
    <label
      className={cn(
        "flex items-center gap-2 rounded-lg border border-border bg-background/40 px-2.5 py-2 text-sm text-foreground",
        readOnly ? "opacity-60" : "cursor-pointer"
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={readOnly}
        onChange={(e) => onChange?.(e.target.checked)}
        className="size-4 accent-[var(--primary)]"
      />
      {label}
    </label>
  );
}

/** A short human summary of which caps are on, e.g. "כספים · קריאות שירות". */
export function summarizeCaps(v: CapValues): string {
  const parts: string[] = [];
  if (v.isManager) parts.push(CAP_LABELS.isManager);
  if (v.finance) parts.push(CAP_LABELS.finance);
  if (v.serviceCalls) parts.push(CAP_LABELS.serviceCalls);
  if (v.approve) parts.push(CAP_LABELS.approve);
  if (v.files) parts.push(CAP_LABELS.files);
  return parts.join(" · ") || "ללא הרשאות";
}
