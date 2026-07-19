import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, UserPlus, Users, IdCard, Search } from "lucide-react";
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
import {
  useAdminOrgMembers,
  useAttachCandidates,
  useClientOrgId,
  addOrgMember,
  attachOrgMember,
  removeOrgMember,
  setMemberCaps,
} from "@/hooks/useOrg";
import { CAP_PRESETS, CapCheckbox, type CapValues } from "@/components/org/capabilityFields";
import type { OrgAttachCandidate, OrgMemberRow } from "@/types/database";

/**
 * Admin-side org-member management on a client's detail page: lists the
 * business's team (real + pending members), lets the admin edit each member's
 * capabilities (presets or per-toggle), remove members, and add new ones -
 * either by attaching an existing client/partner, or by inviting a brand new
 * email that has no profile yet.
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
    serviceView: row.can_service_view,
  });
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const isPartner = row.role === "partner";

  const dirty =
    caps.isManager !== row.is_manager ||
    caps.finance !== row.can_finance ||
    caps.serviceCalls !== row.can_service_calls ||
    caps.approve !== row.can_approve ||
    caps.files !== row.can_files ||
    caps.serviceView !== row.can_service_view;

  async function save() {
    if (!row.member_id) return;
    setSaving(true);
    const { error } = await setMemberCaps(row.member_id, caps);
    setSaving(false);
    if (error) {
      return toastError(
        error.message?.includes("partner_cannot_manage")
          ? "שותף לא יכול להיות מנהל של עסק."
          : error.message || "עדכון ההרשאות נכשל."
      );
    }
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
            {isPartner && <Badge variant="secondary">שת&quot;פ</Badge>}
            {row.is_pending && <Badge variant="warning">ממתין להצטרפות</Badge>}
          </p>
          {row.email !== row.full_name && (
            <p className="truncate font-mono-code text-xs text-muted-foreground">{row.email}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {row.user_id && (
            <Button asChild variant="ghost" size="sm" title="פתיחת כרטיס הלקוח">
              <Link to={`/admin/clients/${row.user_id}`}>
                <IdCard className="size-4" /> לכרטיס לקוח
              </Link>
            </Button>
          )}
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
      </div>

      {row.is_pending ? (
        <p className="text-xs text-muted-foreground">
          {[
            row.can_finance && "כספים",
            row.can_service_calls && "קריאות שירות",
            row.can_approve && "אישור עבודות",
            row.can_files && "קבצים",
            row.can_service_view && "דשבורד שירות",
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
            <CapCheckbox
              label="מנהל"
              checked={caps.isManager}
              disabled={isPartner}
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
            <CapCheckbox
              label="גישה לדשבורד השירות"
              helper="מצב האתר, ביצועים, גיבויים וקריאות שירות."
              checked={caps.serviceView}
              onChange={(v) => setCaps((c) => ({ ...c, serviceView: v }))}
            />
          </div>
          {isPartner && (
            <p className="text-xs text-muted-foreground">שותף לא יכול להיות מנהל של עסק לקוח.</p>
          )}
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

type AddMode = "client" | "partner" | "email";

const ADD_MODES: { id: AddMode; label: string }[] = [
  { id: "client", label: "לקוח קיים" },
  { id: "partner", label: "שותף" },
  { id: "email", label: "הזמנה במייל" },
];

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
  const [mode, setMode] = useState<AddMode>("client");
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [caps, setCaps] = useState<CapValues>(CAP_PRESETS.team);
  const [saving, setSaving] = useState(false);

  const { data: candidates, isLoading: candidatesLoading } = useAttachCandidates(
    open && mode !== "email" ? orgId : undefined
  );

  // A partner can never manage a client's business - keep the toggle off
  // whenever partner mode is active (the DB rejects it anyway; this is UX).
  useEffect(() => {
    if (mode === "partner" && caps.isManager) {
      setCaps((c) => ({ ...c, isManager: false }));
    }
  }, [mode, caps.isManager]);

  const filteredCandidates = useMemo(() => {
    const role = mode === "partner" ? "partner" : mode === "client" ? "client" : null;
    if (!role || !candidates) return [];
    const q = search.trim().toLowerCase();
    return candidates
      .filter((c) => c.role === role)
      .filter((c) => !q || c.full_name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q));
  }, [candidates, mode, search]);

  function reset() {
    setMode("client");
    setSearch("");
    setSelectedUserId(null);
    setFullName("");
    setEmail("");
    setCaps(CAP_PRESETS.team);
  }

  function close() {
    reset();
    onClose();
  }

  async function saveEmail() {
    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes("@")) return toastError("יש להזין אימייל תקין.");
    setSaving(true);
    const { error } = await addOrgMember({ orgId, email: trimmed, fullName: fullName.trim() || null, caps });
    setSaving(false);
    if (error) return toastError(error.message || "הוספת החבר נכשלה.");
    toast({ title: "החבר נוסף לצוות", variant: "success" });
    onAdded();
    close();
  }

  async function saveAttach() {
    if (!selectedUserId) {
      return toastError(mode === "partner" ? "יש לבחור שותף." : "יש לבחור לקוח.");
    }
    setSaving(true);
    const { data, error } = await attachOrgMember({ orgId, userId: selectedUserId, caps });
    setSaving(false);
    if (error) return toastError("השיוך נכשל.");
    const result = data as { ok: boolean; error?: string } | null;
    if (!result?.ok) {
      return toastError(
        result?.error === "partner_cannot_manage"
          ? "שותף לא יכול להיות מנהל של עסק."
          : "השיוך נכשל."
      );
    }
    toast({ title: "החבר שויך לעסק", variant: "success" });
    onAdded();
    close();
  }

  function save() {
    if (mode === "email") return saveEmail();
    return saveAttach();
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && close()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>הוספת חבר צוות</SheetTitle>
          <SheetDescription>
            {mode === "email"
              ? "אם כבר יש לו/ה חשבון, הגישה תתעדכן מיד. אם עדיין אין, ההרשאות ימתינו וייכנסו לתוקף בהתחברות הראשונה שלו/ה."
              : "בחר/י מתוך אנשי הקשר הקיימים במערכת וקבע/י את ההרשאות."}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2">
            {ADD_MODES.map((m) => (
              <Button
                key={m.id}
                type="button"
                size="sm"
                variant={mode === m.id ? "default" : "outline"}
                onClick={() => {
                  setMode(m.id);
                  setSelectedUserId(null);
                  setSearch("");
                }}
              >
                {m.label}
              </Button>
            ))}
          </div>

          {mode === "email" ? (
            <>
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
            </>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="om-search">חיפוש {mode === "partner" ? "שותף" : "לקוח"}</Label>
              <div className="relative">
                <Search className="pointer-events-none absolute inset-y-0 my-auto ms-3 size-4 text-muted-foreground" />
                <Input
                  id="om-search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="שם או אימייל"
                  className="ps-9"
                />
              </div>

              {candidatesLoading ? (
                <Skeleton className="h-32 w-full rounded-xl" />
              ) : !filteredCandidates.length ? (
                <p className="rounded-xl border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  {mode === "partner" ? "לא נמצאו שותפים תואמים." : "לא נמצאו לקוחות תואמים."}
                </p>
              ) : (
                <div className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-border p-2">
                  {filteredCandidates.map((c) => (
                    <CandidateOption
                      key={c.user_id}
                      candidate={c}
                      selected={selectedUserId === c.user_id}
                      onSelect={() => setSelectedUserId(c.user_id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

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
              disabled={mode === "partner"}
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
            <CapCheckbox
              label="גישה לדשבורד השירות"
              helper="מצב האתר, ביצועים, גיבויים וקריאות שירות."
              checked={caps.serviceView}
              onChange={(v) => setCaps((c) => ({ ...c, serviceView: v }))}
              className="col-span-2"
            />
          </div>
          {mode === "partner" && (
            <p className="text-xs text-muted-foreground">שותף לא יכול להיות מנהל של עסק לקוח.</p>
          )}
        </div>

        <SheetFooter>
          <Button onClick={save} disabled={saving}>
            {saving ? "מוסיף…" : "הוספה"}
          </Button>
          <Button variant="ghost" onClick={close}>
            ביטול
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function CandidateOption({
  candidate,
  selected,
  onSelect,
}: {
  candidate: OrgAttachCandidate;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={candidate.already_member}
      onClick={onSelect}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-start text-sm transition-colors",
        candidate.already_member
          ? "cursor-not-allowed border-border bg-background/20 opacity-60"
          : selected
            ? "border-primary bg-primary/10"
            : "border-border bg-background/30 hover:border-primary/40"
      )}
    >
      <span className="min-w-0">
        <span className="block truncate font-medium text-foreground">{candidate.full_name}</span>
        <span className="block truncate font-mono-code text-xs text-muted-foreground">{candidate.email}</span>
      </span>
      {candidate.already_member && (
        <Badge variant="warning" className="shrink-0">
          כבר משויך
        </Badge>
      )}
    </button>
  );
}
