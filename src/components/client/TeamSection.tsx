import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Users, UserPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { gendered } from "@/lib/gender";
import { toast, toastError } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useMyOrgMembers, requestMemberInvite } from "@/hooks/useOrg";
import { CAP_PRESETS, CapCheckbox, summarizeCaps, type CapValues } from "@/components/org/capabilityFields";
import type { OrgMemberRow } from "@/types/database";

/**
 * Manager-only "your team" section for the client dashboard. Shown only when
 * useMyOrgMembers() returns members - an empty list means the caller isn't a
 * manager of any org, so the section (and the fact it exists) stays invisible
 * to regular clients/team members.
 */
export function TeamSection() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const { data: members } = useMyOrgMembers();
  const [inviteOpen, setInviteOpen] = useState(false);

  if (!members?.length) return null;

  return (
    <div className="mt-10" data-tour="team">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
          <Users className="size-5 text-muted-foreground" /> הצוות שלך
        </h2>
        <Button size="sm" variant="secondary" onClick={() => setInviteOpen(true)}>
          <UserPlus className="size-4" /> {gendered(profile?.gender, "הזמן איש צוות", "הזמיני איש צוות")}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {members.map((m) => (
          <TeamMemberCard key={m.member_id ?? `pending-${m.email}`} row={m} />
        ))}
      </div>

      <InviteMemberSheet
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSent={() => qc.invalidateQueries({ queryKey: ["my-org-members"] })}
      />
    </div>
  );
}

function TeamMemberCard({ row }: { row: OrgMemberRow }) {
  const caps: CapValues = {
    isManager: row.is_manager,
    finance: row.can_finance,
    serviceCalls: row.can_service_calls,
    approve: row.can_approve,
    files: row.can_files,
    serviceView: row.can_service_view,
  };
  return (
    <Card className={cn("p-4", row.is_pending && "border-warning/40 bg-warning/[0.06]")}>
      <p className="flex flex-wrap items-center gap-1.5 font-medium text-foreground">
        <span className="min-w-0 truncate">{row.full_name}</span>
        {row.is_manager && <Badge>מנהל</Badge>}
        {row.is_pending && <Badge variant="warning">ממתין להצטרפות</Badge>}
      </p>
      {row.email !== row.full_name && (
        <p className="truncate font-mono-code text-xs text-muted-foreground">{row.email}</p>
      )}
      <p className="mt-1.5 text-xs text-muted-foreground">{summarizeCaps(caps)}</p>
    </Card>
  );
}

function InviteMemberSheet({
  open,
  onClose,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  onSent: () => void;
}) {
  const { profile } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [caps, setCaps] = useState<CapValues>(CAP_PRESETS.team);
  const [sending, setSending] = useState(false);

  function reset() {
    setFullName("");
    setEmail("");
    setPhone("");
    setNote("");
    setCaps(CAP_PRESETS.team);
  }

  async function send() {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) return toastError("יש להזין אימייל תקין.");
    setSending(true);
    const { error } = await requestMemberInvite({
      fullName: fullName.trim() || null,
      email: trimmed,
      phone: phone.trim() || null,
      note: note.trim() || null,
      caps: { finance: caps.finance, serviceCalls: caps.serviceCalls, approve: caps.approve, files: caps.files },
    });
    setSending(false);
    if (error) return toastError(error.message || "שליחת הבקשה נכשלה.");
    toast({ title: "הבקשה נשלחה, נעדכן אותך כשנוסיף אותו/ה", variant: "success" });
    reset();
    onSent();
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>הזמנת איש צוות</SheetTitle>
          <SheetDescription>
            {gendered(
              profile?.gender,
              "מלא את הפרטים; הבקשה תישלח לסטודיו לאישור, ואיש הקשר יקבל גישה בהתחברות הראשונה שלו.",
              "מלאי את הפרטים; הבקשה תישלח לסטודיו לאישור, ואיש הקשר יקבל גישה בהתחברות הראשונה שלו."
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="inv-name">שם מלא</Label>
            <Input id="inv-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="ישראל ישראלי" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-email">אימייל</Label>
            <Input
              id="inv-email"
              dir="ltr"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@business.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-phone">טלפון (רשות)</Label>
            <Input id="inv-phone" dir="ltr" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="050-0000000" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="inv-note">הערה לסטודיו (רשות)</Label>
            <Textarea
              id="inv-note"
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={gendered(profile?.gender, "למשל: התפקיד שלו בעסק", "למשל: התפקיד שלה בעסק")}
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium text-foreground">מה יוכל/תוכל לעשות בפרויקטים שלך</p>
            <div className="mb-2 flex flex-wrap gap-2">
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
            <p className="mt-2 text-xs text-muted-foreground">
              תפקיד "מנהל" (הרשאה להזמין אנשי צוות נוספים) נקבע ע"י הסטודיו באישור הבקשה.
            </p>
          </div>
        </div>

        <SheetFooter>
          <Button onClick={send} disabled={sending}>
            {sending ? "שולח…" : "שליחת הבקשה"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            ביטול
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
