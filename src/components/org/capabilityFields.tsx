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
  serviceView: boolean;
};

/** מנהל = is_manager + all 4 caps; צוות = service_calls/approve/files (no finance,
 * no manager); צופה = all false. */
export const CAP_PRESETS: Record<"manager" | "team" | "viewer", CapValues> = {
  manager: { isManager: true, finance: true, serviceCalls: true, approve: true, files: true, serviceView: true },
  team: { isManager: false, finance: false, serviceCalls: true, approve: true, files: true, serviceView: true },
  viewer: { isManager: false, finance: false, serviceCalls: false, approve: false, files: false, serviceView: false },
};

export const CAP_LABELS: Record<keyof CapValues, string> = {
  isManager: "מנהל",
  finance: "כספים",
  serviceCalls: "קריאות שירות",
  approve: "אישור עבודות",
  files: "קבצים",
  serviceView: "גישה לדשבורד השירות",
};

/** A single capability checkbox (checkbox + label + optional helper text under
 * it), matching the studio's existing checkbox convention (accent-colored
 * native input). */
export function CapCheckbox({
  label,
  helper,
  checked,
  onChange,
  disabled,
  className,
}: {
  label: string;
  helper?: string;
  checked: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  const readOnly = disabled || !onChange;
  return (
    <label
      className={cn(
        "flex items-start gap-2 rounded-lg border border-border bg-background/40 px-2.5 py-2 text-sm text-foreground",
        readOnly ? "opacity-60" : "cursor-pointer",
        className
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={readOnly}
        onChange={(e) => onChange?.(e.target.checked)}
        className="mt-0.5 size-4 shrink-0 accent-[var(--primary)]"
      />
      <span>
        {label}
        {helper && <span className="mt-0.5 block text-xs text-muted-foreground">{helper}</span>}
      </span>
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
  if (v.serviceView) parts.push(CAP_LABELS.serviceView);
  return parts.join(" · ") || "ללא הרשאות";
}
