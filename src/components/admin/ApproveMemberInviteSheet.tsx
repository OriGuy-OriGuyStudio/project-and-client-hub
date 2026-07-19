import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { toast, toastError } from "@/hooks/use-toast";
import { approveMemberInvite } from "@/hooks/useOrg";
import { CAP_PRESETS, CapCheckbox, type CapValues } from "@/components/org/capabilityFields";
import type { AdminTaskMemberInvite } from "@/hooks/useAdminTasks";

/**
 * Admin reviews + finalizes a manager's "add a teammate" request: pre-filled
 * from the requested capabilities, with is_manager + everything else still
 * adjustable before it's materialized into organization_members.
 */
export function ApproveMemberInviteSheet({
  request,
  onClose,
  onApproved,
}: {
  request: AdminTaskMemberInvite | null;
  onClose: () => void;
  onApproved: () => void;
}) {
  const [caps, setCaps] = useState<CapValues>(CAP_PRESETS.team);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!request) return;
    setCaps({
      isManager: false,
      finance: request.reqFinance,
      serviceCalls: request.reqServiceCalls,
      approve: request.reqApprove,
      files: request.reqFiles,
      // Not part of the manager's invite request - keeps the DB default (true).
      serviceView: true,
    });
  }, [request]);

  async function approve() {
    if (!request) return;
    setSaving(true);
    const { error } = await approveMemberInvite(request.id, caps);
    setSaving(false);
    if (error) return toastError(error.message || "האישור נכשל.");
    toast({ title: "החבר נוסף לצוות ✓", variant: "success" });
    onApproved();
  }

  return (
    <Sheet open={!!request} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>אישור הצטרפות לצוות</SheetTitle>
          <SheetDescription>
            אפשר להתאים את ההרשאות לפני האישור. הבקשה תוסר מהרשימה וההרשאות ייכנסו לתוקף בהתחברות
            הראשונה שלו/ה (אם עדיין אין לו/ה חשבון).
          </SheetDescription>
        </SheetHeader>

        {request && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-background/30 p-3 text-sm">
              <p className="font-medium text-foreground">{request.fullName || request.email}</p>
              <p className="font-mono-code text-xs text-muted-foreground">
                {request.email}
                {request.phone ? ` · ${request.phone}` : ""}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{request.orgName}</p>
              {request.note && (
                <p className="mt-1.5 rounded-lg bg-card px-2.5 py-1.5 text-xs text-muted-foreground">
                  {request.note}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="secondary" onClick={() => setCaps(CAP_PRESETS.manager)}>
                מנהל
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setCaps(CAP_PRESETS.team)}>
                צוות
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => setCaps(CAP_PRESETS.viewer)}>
                צופה
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <CapCheckbox label="מנהל" checked={caps.isManager} onChange={(v) => setCaps((c) => ({ ...c, isManager: v }))} />
              <CapCheckbox label="כספים" checked={caps.finance} onChange={(v) => setCaps((c) => ({ ...c, finance: v }))} />
              <CapCheckbox
                label="קריאות שירות"
                checked={caps.serviceCalls}
                onChange={(v) => setCaps((c) => ({ ...c, serviceCalls: v }))}
              />
              <CapCheckbox
                label="אישור עבודות"
                checked={caps.approve}
                onChange={(v) => setCaps((c) => ({ ...c, approve: v }))}
              />
              <CapCheckbox label="קבצים" checked={caps.files} onChange={(v) => setCaps((c) => ({ ...c, files: v }))} />
            </div>
          </div>
        )}

        <SheetFooter>
          <Button onClick={approve} disabled={saving || !request}>
            {saving ? "מאשר…" : "אישור והוספה לצוות"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            ביטול
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
