import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, UserPlus, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { toast, toastError } from "@/hooks/use-toast";
import { useAdminOrgMembers, useClientOrgId, addOrgMember, removeOrgMember, setMemberCaps } from "@/hooks/useOrg";
import { CAP_PRESETS, CapCheckbox, type CapValues } from "@/components/org/capabilityFields";
import type { OrgMemberRow } from "@/types/database";

/**
 * Admin-side org-member management on a client's detail page: lists the
 * business's team (real + pending members), lets the admin edit each member's
 * capabilities (presets or per-toggle), remove members, and add new ones.
 */
export function OrgMembersSection({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { data: orgId, isLoading: orgLoading } = useClientOrgId(clientId);
  const { data: members, isLoading: membersLoading } = useAdminOrgMembers(orgId);
  const [addOpen, setAddOpen] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-org-members", orgId] });

  if (orgLoading) {
    return <Skeleton className="h-32 w-full rounded-2xl" />;
  }
  if (!orgId) return null; // client has no org yet (pre-onboarding) - nothing to manage

  return (
    <Card id="cd-team" data-section className="scroll-mt-20 space-y-4 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
          <Users className="size-5 text-muted-foreground" /> צוות וגישה
        </h2>
        <Button size="sm" variant="secondary" onClick={() => setAddOpen(true)}>
          <UserPlus className="size-4" /> הוסף חבר
        </Button>
      </div>

      {membersLoading ? (
        <Skeleton className="h-20 w-full rounded-2xl" />
      ) : !members?.length ? (
        <p className="text-sm text-muted-foreground">אין עדיין חברי צוות נוספים מעבר לבעל/ת החשבון.</p>
      ) : (
        <div className="space-y-2">
          {members.map((m) => (
            <MemberRow key={m.member_id ?? `pending-${m.email}`} row={m} onSaved={refresh} />
          ))}
        </div>
      )}

      <AddMemberSheet open={addOpen} onClose={() => setAddOpen(false)} orgId={orgId} onAdded={refresh} />
    </Card>
  );
}

function MemberRow({ row, onSaved }: { row: OrgMemberRow; onSaved: () => void }) {
  const [caps, setCaps] = useState<CapValues>({
    isManager: row.is_manager,
    finance: row.can_finance,
    serviceCalls: row.can_service_calls,
    approve: row.can_approve,
    files: row.can_files,
  });
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const dirty =
    caps.isManager !== row.is_manager ||
    caps.finance !== row.can_finance ||
    caps.serviceCalls !== row.can_service_calls ||
    caps.approve !== row.can_approve ||
    caps.files !== row.can_files;

  async function save() {
    if (!row.member_id) return;
    setSaving(true);
    const { error } = await setMemberCaps(row.member_id, caps);
    setSaving(false);
    if (error) return toastError(error.message || "עדכון ההרשאות נכשל.");
    toast({ title: "ההרשאות עודכנו", variant: "success" });
    onSaved();
  }

  async function remove() {
    if (!row.member_id) return;
    setRemoving(true);
    const { error } = await removeOrgMember(row.member_id);
    setRemoving(false);
    if (error) {
      return toastError(
        error.message?.includes("last manager")
          ? "אי אפשר להסיר את המנהל האחרון."
          : error.message || "ההסרה נכשלה."
      );
    }
    toast({ title: "החבר הוסר מהצוות", variant: "success" });
    onSaved();
  }

  return (
    <div
      className={cn(
        "space-y-3 rounded-xl border p-4",
        row.is_pending ? "border-warning/40 bg-warning/[0.06]" : "border-border bg-background/30"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 font-medium text-foreground">
            <span className="truncate">{row.full_name}</span>
            {row.is_manager && <Badge>מנהל</Badge>}
            {row.is_pending && <Badge variant="warning">ממתין להצטרפות</Badge>}
          </p>
          {row.email !== row.full_name && (
            <p className="truncate font-mono-code text-xs text-muted-foreground">{row.email}</p>
          )}
        </div>
        {!row.is_pending && row.member_id && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="הסרת חבר צוות"
            disabled={removing}
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="size-4 text-muted-foreground" />
          </Button>
        )}
      </div>

      {row.is_pending ? (
        <p className="text-xs text-muted-foreground">
          {[
            row.can_finance && "כספים",
            row.can_service_calls && "קריאות שירות",
            row.can_approve && "אישור עבודות",
            row.can_files && "קבצים",
          ]
            .filter(Boolean)
            .join(" · ") || "ללא הרשאות"}
          <span className="mr-2 italic">בהמתנה עד ההתחברות הראשונה</span>
        </p>
      ) : (
        <>
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
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <CapCheckbox label="מנהל" checked={caps.isManager} onChange={(v) => setCaps((c) => ({ ...c, isManager: v }))} />
            <CapCheckbox label="כספים" checked={caps.finance} onChange={(v) => setCaps((c) => ({ ...c, finance: v }))} />
            <CapCheckbox
              label="קריאות שירות"
              checked={caps.serviceCalls}
              onChange={(v) => setCaps((c) => ({ ...c, serviceCalls: v }))}
            />
            <CapCheckbox label="אישור עבודות" checked={caps.approve} onChange={(v) => setCaps((c) => ({ ...c, approve: v }))} />
            <CapCheckbox label="קבצים" checked={caps.files} onChange={(v) => setCaps((c) => ({ ...c, files: v }))} />
          </div>
          <Button size="sm" disabled={!dirty || saving} onClick={save}>
            {saving ? "שומר…" : "שמירה"}
          </Button>
        </>
      )}

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="הסרת חבר צוות"
        destructive
        confirmLabel="הסרה"
        description={`להסיר את ${row.full_name} מהצוות? הגישה שלו/ה לפרויקטים תבוטל.`}
        onConfirm={remove}
      />
    </div>
  );
}

function AddMemberSheet({
  open,
  onClose,
  orgId,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  orgId: string;
  onAdded: () => void;
}) {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [caps, setCaps] = useState<CapValues>(CAP_PRESETS.team);
  const [saving, setSaving] = useState(false);

  function reset() {
    setFullName("");
    setEmail("");
    setCaps(CAP_PRESETS.team);
  }

  async function save() {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) return toastError("יש להזין אימייל תקין.");
    setSaving(true);
    const { error } = await addOrgMember({ orgId, email: trimmed, fullName: fullName.trim() || null, caps });
    setSaving(false);
    if (error) return toastError(error.message || "הוספת החבר נכשלה.");
    toast({ title: "החבר נוסף לצוות", variant: "success" });
    reset();
    onAdded();
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>הוספת חבר צוות</SheetTitle>
          <SheetDescription>
            אם כבר יש לו/ה חשבון, הגישה תתעדכן מיד. אם עדיין אין, ההרשאות ימתינו וייכנסו לתוקף
            בהתחברות הראשונה שלו/ה.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="om-name">שם מלא (רשות)</Label>
            <Input id="om-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="ישראל ישראלי" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="om-email">אימייל</Label>
            <Input
              id="om-email"
              dir="ltr"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@business.com"
            />
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
            <CapCheckbox
              label="מנהל (יכול/ה להזמין אנשי צוות)"
              checked={caps.isManager}
              onChange={(v) => setCaps((c) => ({ ...c, isManager: v }))}
            />
            <CapCheckbox label="כספים" checked={caps.finance} onChange={(v) => setCaps((c) => ({ ...c, finance: v }))} />
            <CapCheckbox
              label="קריאות שירות"
              checked={caps.serviceCalls}
              onChange={(v) => setCaps((c) => ({ ...c, serviceCalls: v }))}
            />
            <CapCheckbox label="אישור עבודות" checked={caps.approve} onChange={(v) => setCaps((c) => ({ ...c, approve: v }))} />
            <CapCheckbox label="קבצים" checked={caps.files} onChange={(v) => setCaps((c) => ({ ...c, files: v }))} />
          </div>
        </div>

        <SheetFooter>
          <Button onClick={save} disabled={saving}>
            {saving ? "מוסיף…" : "הוספה"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            ביטול
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
