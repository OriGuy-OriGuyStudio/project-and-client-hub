import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, TriangleAlert } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectMenu } from "@/components/ui/select-menu";
import { supabase } from "@/lib/supabase";
import { toast, toastError } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { gendered } from "@/lib/gender";
import { clampText } from "@/lib/sanitize";
import { isDemoEmail } from "@/lib/demo";
import type { AdminCreateBusinessResult } from "@/types/database";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Kind = "real" | "demo" | "studio";

const KIND_OPTIONS: { value: Kind; label: string }[] = [
  { value: "real", label: "עסק פעיל" },
  { value: "demo", label: "טסט (דמה)" },
  { value: "studio", label: "סטודיו (פנימי)" },
];

/** A `@origuystudio.com` email defaults to studio, a known demo email (src/lib/demo.ts)
 * defaults to demo, otherwise real. The admin can still override via the select. */
function deriveKind(email: string): Kind {
  const trimmed = email.trim().toLowerCase();
  if (isDemoEmail(trimmed)) return "demo";
  if (trimmed.endsWith("@origuystudio.com")) return "studio";
  return "real";
}

/**
 * Admin-only "add business": creates a new organization + its founding manager
 * (all capabilities) in one guarded RPC call. If the manager email already
 * belongs to an existing business, the RPC refuses to create a duplicate
 * membership and this sheet offers a link to that business instead.
 */
export function AddBusinessSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const { profile } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [kind, setKind] = useState<Kind>("real");
  const [kindTouched, setKindTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [existingOrgId, setExistingOrgId] = useState<string | null>(null);

  function reset() {
    setName("");
    setEmail("");
    setKind("real");
    setKindTouched(false);
    setExistingOrgId(null);
  }

  function updateEmail(v: string) {
    setEmail(v);
    if (!kindTouched) setKind(deriveKind(v));
  }

  function updateKind(v: Kind) {
    setKind(v);
    setKindTouched(true);
  }

  function close() {
    reset();
    onClose();
  }

  async function save() {
    const trimmedName = clampText(name.trim(), 120);
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedName) return toastError("יש להזין שם עסק.");
    if (!EMAIL_RE.test(trimmedEmail)) return toastError("יש להזין אימייל תקין למנהל/ת העסק.");

    setSaving(true);
    const { data, error } = await supabase.rpc("admin_create_business", {
      p_name: trimmedName,
      p_manager_email: trimmedEmail,
      p_kind: kind,
    });
    setSaving(false);

    if (error) return toastError(error.message || "יצירת העסק נכשלה.");

    const result = data as AdminCreateBusinessResult;
    if (result.status === "email_exists") {
      setExistingOrgId(result.org_id);
      return;
    }

    toast({ title: "העסק נוצר בהצלחה ✓", variant: "success" });
    qc.invalidateQueries({ queryKey: ["admin-businesses"] });
    close();
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>הוספת עסק חדש</SheetTitle>
          <SheetDescription>
            העסק ומנהל/ת החשבון הראשי/ה (עם כל ההרשאות) ייווצרו יחד. ההרשאות ייכנסו לתוקף
            בהתחברות הראשונה של מנהל/ת החשבון, אם עדיין אין לו/ה חשבון.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ab-name">שם העסק</Label>
            <Input
              id="ab-name"
              value={name}
              maxLength={120}
              onChange={(e) => {
                setName(e.target.value);
                setExistingOrgId(null);
              }}
              placeholder="שם העסק של הלקוח"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ab-email">אימייל מנהל/ת העסק</Label>
            <Input
              id="ab-email"
              dir="ltr"
              type="email"
              value={email}
              onChange={(e) => {
                updateEmail(e.target.value);
                setExistingOrgId(null);
              }}
              placeholder="manager@business.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label>סוג עסק</Label>
            <SelectMenu variant="field" ariaLabel="סוג עסק" value={kind} onChange={updateKind} options={KIND_OPTIONS} />
          </div>

          {existingOrgId && (
            <div className="flex items-start gap-2.5 rounded-xl border border-warning/40 bg-warning/[0.06] p-3 text-sm">
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warning" />
              <div className="min-w-0 space-y-1.5">
                <p className="text-foreground">האימייל כבר שייך לעסק קיים. אי אפשר ליצור עסק כפול עבורו.</p>
                <Button asChild size="sm" variant="secondary">
                  <Link to={`/admin/businesses/${existingOrgId}`} onClick={close}>
                    <Building2 className="size-4" /> מעבר לעסק הקיים
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </div>

        <SheetFooter>
          <Button onClick={save} disabled={saving}>
            {saving ? gendered(profile?.gender, "יוצר…", "יוצרת…") : "יצירת עסק"}
          </Button>
          <Button variant="ghost" onClick={close}>
            ביטול
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
