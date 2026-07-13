import { useEffect, useState } from "react";
import { Building2, Check, Mail, Phone, User } from "lucide-react";
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
import { supabase } from "@/lib/supabase";
import { toast, toastError } from "@/hooks/use-toast";
import type { AdminTaskAccessRequest } from "@/hooks/useAdminTasks";

/**
 * Admin previews + confirms turning a portal access request into a BUSINESS: the
 * business name + manager (contact) name are editable, everything that will be
 * created is spelled out, and confirming runs `approve_access_request_as_business`
 * (org + founding manager + whitelist + brand). This is the guard against the old
 * bug where approving created an org-less, unlinkable client.
 */
export function ApproveAccessRequestSheet({
  request,
  onClose,
  onApproved,
}: {
  request: AdminTaskAccessRequest | null;
  onClose: () => void;
  onApproved: () => void;
}) {
  const [businessName, setBusinessName] = useState("");
  const [managerName, setManagerName] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!request) return;
    setBusinessName(request.businessName ?? "");
    setManagerName(request.fullName ?? "");
  }, [request]);

  async function approve() {
    if (!request) return;
    if (!businessName.trim()) return toastError("צריך שם עסק.");
    if (!managerName.trim()) return toastError("צריך שם מנהל.");
    setSaving(true);
    const { data, error } = await supabase.rpc("approve_access_request_as_business", {
      p_id: request.id,
      p_business_name: businessName.trim(),
      p_manager_name: managerName.trim(),
    });
    setSaving(false);
    if (error) return toastError(error.message || "הקמת העסק נכשלה.");
    const status = (data as { status?: string } | null)?.status;
    toast({
      title:
        status === "email_exists"
          ? "המייל כבר משויך לעסק קיים. הבקשה סומנה כטופלה."
          : "העסק והלקוח הוקמו ✓ הוא יקבל גישה בהתחברות הבאה",
      variant: "success",
    });
    onApproved();
  }

  return (
    <Sheet open={!!request} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>הקמת עסק + לקוח</SheetTitle>
          <SheetDescription>
            בדוק את הפרטים לפני ההקמה. אפשר לתקן את שם העסק ושם המנהל. ההקמה תפתח עסק חדש,
            תוסיף את מבקש הגישה כמנהל, ותיתן לו גישה לפורטל בהתחברות הבאה שלו.
          </SheetDescription>
        </SheetHeader>

        {request && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="aar-biz">שם העסק</Label>
              <Input
                id="aar-biz"
                value={businessName}
                maxLength={160}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="השם שיופיע לעסק בפורטל"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aar-mgr">שם המנהל (איש הקשר)</Label>
              <Input
                id="aar-mgr"
                value={managerName}
                maxLength={120}
                onChange={(e) => setManagerName(e.target.value)}
              />
            </div>

            {/* Read-only identity from the request. */}
            <div className="space-y-1 rounded-xl border border-border bg-background/30 p-3 text-sm">
              <p className="inline-flex items-center gap-1.5 font-mono-code text-xs text-muted-foreground">
                <Mail className="size-3" /> {request.email}
              </p>
              {request.phone && (
                <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Phone className="size-3" /> {request.phone}
                </p>
              )}
              {request.message && (
                <p className="mt-1.5 rounded-lg bg-card px-2.5 py-1.5 text-xs text-muted-foreground">
                  {request.message}
                </p>
              )}
            </div>

            {/* What the confirmation will create. */}
            <div className="space-y-2 rounded-xl border border-primary/30 bg-primary/[0.05] p-3">
              <p className="text-xs font-semibold text-muted-foreground">מה ייווצר:</p>
              <ul className="space-y-1.5 text-sm text-foreground">
                <li className="flex items-center gap-2">
                  <Building2 className="size-4 shrink-0 text-primary" />
                  עסק חדש: <span className="font-semibold">{businessName.trim() || "—"}</span>
                </li>
                <li className="flex items-center gap-2">
                  <User className="size-4 shrink-0 text-primary" />
                  חשבון מנהל: <span className="font-semibold">{managerName.trim() || "—"}</span> (הרשאות מלאות)
                </li>
                <li className="flex items-center gap-2">
                  <Check className="size-4 shrink-0 text-primary" />
                  גישה לפורטל למייל <span className="font-mono-code text-xs">{request.email}</span>
                </li>
              </ul>
            </div>
          </div>
        )}

        <SheetFooter>
          <Button onClick={approve} disabled={saving || !request}>
            {saving ? "מקים…" : "הקם עסק + לקוח"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            ביטול
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
