import type { BrandColor, BrandColorRole } from "@/types/database";

const roleHe: Record<BrandColorRole, string> = {
  primary: "צבע ראשי",
  secondary: "צבע משני",
  accent: "צבע הדגשה",
  background: "רקע",
  text: "טקסט",
  other: "אחר",
};

export function ColorSwatch({ color }: { color: BrandColor }) {
  const label = color.label || (color.role ? roleHe[color.role] : "");
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div
        className="size-16 rounded-2xl border border-border shadow-inner"
        style={{ backgroundColor: color.hex_value }}
        title={color.hex_value}
      />
      {label && (
        <span className="text-xs font-medium text-foreground">{label}</span>
      )}
      <span className="font-mono-code text-[11px] uppercase text-muted-foreground">
        {color.hex_value}
      </span>
    </div>
  );
}
