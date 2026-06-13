import type { BrandColor, BrandColorRole } from "@/types/database";
import { CopyButton } from "@/components/ui/copy-button";

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
      <div className="flex items-center gap-1">
        <span className="font-mono-code text-[11px] uppercase text-muted-foreground">
          {color.hex_value}
        </span>
        <CopyButton
          content={color.hex_value}
          variant="ghost"
          size="icon"
          className="size-6 text-muted-foreground hover:text-foreground"
          toastMessage={`הקוד ${color.hex_value.toUpperCase()} הועתק`}
          title="העתקת קוד הצבע"
        />
      </div>
    </div>
  );
}
