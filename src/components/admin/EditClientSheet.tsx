import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectMenu } from "@/components/ui/select-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/sheet";
import { supabase } from "@/lib/supabase";
import { toast, toastError } from "@/hooks/use-toast";
import { clampText } from "@/lib/sanitize";
import { useClientCrm } from "@/hooks/useClientCrm";
import { resolveOrgPrimaryClientId } from "@/hooks/useClientBrand";
import { resolveClientOrgId } from "@/hooks/useOrg";
import { useAuth } from "@/hooks/useAuth";
import type { ClientCallLog } from "@/types/database";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function waLink(phone: string) {
  const digits = phone.replace(/\D/g, "").replace(/^0/, "972");
  return `https://wa.me/${digits}`;
}

/** One row of the Clients list (active profile or pending invite) - also the
 * shape used to open the shared edit sheet from the client's own detail page. */
export type ClientItem = {
  kind: "active" | "pending";
  id: string | null; // profile id (active only)
  email: string;
  full_name: string | null;
  business_name: string | null;
  phone: string | null;
  enrolled: boolean; // approved into the referral program
  inviteSentAt?: string | null; // last welcome-email send (pending invitees)
  lastSeen?: string | null; // last real login (active clients)
};

/**
 * Shared "edit client" side sheet: profile (name/phone), the org's business
 * name (client_brand, resolved to the org's single primary row so it never
 * duplicates), admin-private CRM (gender/role/personal info + call log) for
 * an active client, or the allowed_emails row (email/name/business) for a
 * pending invitee. Used by both the Clients list and the client's own detail
 * page (ClientDetail) so editing behaves identically everywhere.
 */
export function EditClientSheet({
  target,
  onClose,
}: {
  target: ClientItem | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const isActive = target?.kind === "active";
  const crm = useClientCrm(isActive ? target!.id : null);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    business_name: "",
    phone: "",
    enrolled: false,
    gender: "" as "" | "male" | "female" | "other",
    role_in_company: "",
    personal_info: "",
  });
  const [seeded, setSeeded] = useState<string | null>(null);
  const [crmSeeded, setCrmSeeded] = useState<string | null>(null);

  // Seed the basic fields once per opened target.
  const key = target ? `${target.kind}:${target.email}` : null;
  if (target && key !== seeded) {
    setForm((f) => ({
      ...f,
      full_name: target.full_name ?? "",
      email: target.email,
      business_name: target.business_name ?? "",
      phone: target.phone ?? "",
      enrolled: target.enrolled,
    }));
    setSeeded(key);
  }
  // Seed the admin-private CRM fields once loaded.
  if (isActive && crm.data && target!.id !== crmSeeded) {
    setForm((f) => ({
      ...f,
      gender: (crm.data!.note?.gender ?? "") as typeof f.gender,
      role_in_company: crm.data!.note?.role_in_company ?? "",
      personal_info: crm.data!.note?.content ?? "",
    }));
    setCrmSeeded(target!.id);
  }

  function update(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    if (!target) return;
    setSaving(true);
    let noteOrgId: string | null = null;
    try {
      if (target.kind === "pending") {
        const email = form.email.trim().toLowerCase();
        if (!EMAIL_RE.test(email)) {
          toastError("כתובת אימייל לא תקינה.");
          return;
        }
        const { error } = await supabase
          .from("allowed_emails")
          .update({
            email,
            full_name: clampText(form.full_name.trim(), 120) || null,
            business_name: clampText(form.business_name.trim(), 120) || null,
          })
          .eq("email", target.email);
        if (error) throw error;
      } else {
        const { error: pErr } = await supabase
          .from("profiles")
          .update({
            full_name: clampText(form.full_name.trim(), 120) || null,
            phone: clampText(form.phone.trim(), 40) || null,
          })
          .eq("id", target.id!);
        if (pErr) throw pErr;
        // Business name lives on the org's single primary client_brand row -
        // resolve it so quick-editing from a non-primary member's row edits
        // (and never duplicates) the business's one brand row.
        const brandTarget = await resolveOrgPrimaryClientId(target.id!);
        const { error: bErr } = await supabase.from("client_brand").upsert(
          {
            client_id: brandTarget.clientId,
            ...(brandTarget.orgId ? { org_id: brandTarget.orgId, is_org_primary: true } : {}),
            business_name: clampText(form.business_name.trim(), 120) || null,
          },
          { onConflict: "client_id" }
        );
        if (bErr) throw bErr;

        // Admin-private CRM info. org_id is this member's OWN org (not the
        // brand's primary-row target above) - the note is per person, one row
        // per client_id, so it's stamped with whichever org this person
        // belongs to (Task 11: CRM reads by org_id on Business Detail).
        noteOrgId = await resolveClientOrgId(target.id!);
        const { error: nErr } = await supabase
          .from("admin_client_notes")
          .upsert(
            {
              client_id: target.id!,
              org_id: noteOrgId,
              gender: form.gender || null,
              role_in_company: clampText(form.role_in_company.trim(), 120) || null,
              content: clampText(form.personal_info.trim(), 4000) || null,
            },
            { onConflict: "client_id" }
          );
        if (nErr) throw nErr;

        // Mirror gender onto the profile so the client-facing copy can be gendered
        // (admin_client_notes is admin-only and can't be read by the client).
        const { error: gErr } = await supabase
          .from("profiles")
          .update({ gender: form.gender || null })
          .eq("id", target.id!);
        if (gErr) throw gErr;

        // Approve / revoke the referral program for this client.
        if (form.enrolled && !target.enrolled) {
          await supabase
            .from("partner_enrollments")
            .insert({ client_id: target.id!, terms_version: "v1" });
        } else if (!form.enrolled && target.enrolled) {
          await supabase.from("partner_enrollments").delete().eq("client_id", target.id!);
        }
      }
      toast({ title: "הפרטים עודכנו", variant: "success" });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["client-crm", target.id] });
      qc.invalidateQueries({ queryKey: ["client-detail", target.id] });
      if (noteOrgId) qc.invalidateQueries({ queryKey: ["org-notes", noteOrgId] });
      onClose();
    } catch {
      toastError("העדכון נכשל.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>עריכת לקוח</DialogTitle>
          <DialogDescription>
            {target?.kind === "active"
              ? "עדכון שם הלקוח ושם העסק."
              : "עדכון הפרטים לפני הכניסה הראשונה."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="e-name">שם מלא</Label>
            <Input
              id="e-name"
              value={form.full_name}
              maxLength={120}
              onChange={(e) => update("full_name", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-email">אימייל (Google או כל מייל)</Label>
            <Input
              id="e-email"
              dir="ltr"
              type="email"
              value={form.email}
              disabled={target?.kind === "active"}
              onChange={(e) => update("email", e.target.value)}
            />
            {target?.kind === "active" && (
              <p className="text-xs text-muted-foreground">
                לא ניתן לשנות אימייל של לקוח שכבר התחבר.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-business">שם העסק</Label>
            <Input
              id="e-business"
              value={form.business_name}
              maxLength={120}
              onChange={(e) => update("business_name", e.target.value)}
            />
          </div>

          {isActive && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="e-phone">טלפון</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="e-phone"
                    dir="ltr"
                    value={form.phone}
                    maxLength={40}
                    onChange={(e) => update("phone", e.target.value)}
                    placeholder="05X-XXXXXXX"
                  />
                  {form.phone.trim() && (
                    <Button variant="secondary" size="icon" asChild aria-label="וואטסאפ">
                      <a href={waLink(form.phone)} target="_blank" rel="noreferrer noopener">
                        <MessageCircle className="size-4 text-brand-green-base" />
                      </a>
                    </Button>
                  )}
                  {form.phone.trim() && (
                    <Button variant="secondary" size="icon" asChild aria-label="חיוג">
                      <a href={`tel:${form.phone.replace(/\s/g, "")}`}>
                        <Phone className="size-4" />
                      </a>
                    </Button>
                  )}
                  <Button variant="secondary" size="icon" asChild aria-label="מייל">
                    <a
                      href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(target!.email)}`}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      <Mail className="size-4" />
                    </a>
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="e-gender">מין</Label>
                  <SelectMenu
                    id="e-gender"
                    variant="field"
                    ariaLabel="מין"
                    value={form.gender}
                    onChange={(v) => update("gender", v)}
                    options={[
                      { value: "", label: "לא צוין" },
                      { value: "male", label: "זכר" },
                      { value: "female", label: "נקבה" },
                      { value: "other", label: "אחר" },
                    ]}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="e-role">תפקיד בחברה</Label>
                  <Input
                    id="e-role"
                    value={form.role_in_company}
                    maxLength={120}
                    onChange={(e) => update("role_in_company", e.target.value)}
                    placeholder="מנכ״לית, בעלים…"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="e-personal">מידע אישי (פרטי לאדמין)</Label>
                <Textarea
                  id="e-personal"
                  value={form.personal_info}
                  maxLength={4000}
                  onChange={(e) => update("personal_info", e.target.value)}
                  placeholder="שם בן/בת הזוג, ילדים, תחביבים, וכל מה שעוזר לי ליחס אישי…"
                />
              </div>

              <CallLogSection clientId={target!.id!} calls={crm.data?.calls ?? []} />
            </>
          )}

          {isActive && (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background/30 p-3">
              <input
                type="checkbox"
                checked={form.enrolled}
                onChange={(e) => setForm((f) => ({ ...f, enrolled: e.target.checked }))}
                className="mt-0.5 size-4 accent-[var(--primary)]"
              />
              <span className="text-sm">
                <span className="font-medium text-foreground">אישור לתוכנית השותפים</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  רק אחרי אישור הלקוח יראה את תוכנית השותפים (הפניות וקרדיטים).
                </span>
              </span>
            </label>
          )}
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={saving}>
            {saving ? "שומר…" : "שמירה"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CallLogSection({ clientId, calls }: { clientId: string; calls: ClientCallLog[] }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);

  async function add() {
    const summary = clampText(text.trim(), 2000);
    if (!summary) return;
    setAdding(true);
    // Stamp org_id (Task 10/11: client_call_logs.org_id, read org-scoped on
    // Business Detail) so this call log shows up there, not just here.
    const orgId = await resolveClientOrgId(clientId);
    const { error } = await supabase
      .from("client_call_logs")
      .insert({ client_id: clientId, org_id: orgId, summary, created_by: user?.id ?? null });
    setAdding(false);
    if (error) return toastError("הוספת הסיכום נכשלה.");
    setText("");
    qc.invalidateQueries({ queryKey: ["client-crm", clientId] });
    qc.invalidateQueries({ queryKey: ["client-detail", clientId] });
    if (orgId) qc.invalidateQueries({ queryKey: ["org-call-logs", orgId] });
  }

  return (
    <div className="space-y-2 rounded-xl border border-border bg-background/30 p-3">
      <p className="text-sm font-medium text-foreground">סיכומי שיחות</p>
      <div className="flex items-start gap-2">
        <Textarea
          value={text}
          maxLength={2000}
          onChange={(e) => setText(e.target.value)}
          placeholder="סיכום השיחה האחרונה…"
          className="min-h-16"
        />
        <Button size="sm" onClick={add} disabled={adding}>
          {adding ? "מוסיף…" : "הוספה"}
        </Button>
      </div>
      {calls.length > 0 && (
        <ul className="space-y-2 pt-1">
          {calls.map((c) => (
            <li key={c.id} className="rounded-lg bg-card px-3 py-2">
              <p className="whitespace-pre-wrap text-sm text-foreground">{c.summary}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(c.created_at).toLocaleString("he-IL")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
