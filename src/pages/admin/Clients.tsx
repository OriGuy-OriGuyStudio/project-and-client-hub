import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  Clock,
  Eye,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { sendInvite } from "@/lib/invite";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectMenu } from "@/components/ui/select-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/sheet";
import { supabase } from "@/lib/supabase";
import { toast, toastError } from "@/hooks/use-toast";
import { clampText } from "@/lib/sanitize";
import { GENDER_OPTIONS } from "@/lib/gender";
import { useClients } from "@/hooks/useClients";
import { useClientCrm } from "@/hooks/useClientCrm";
import { useAuth } from "@/hooks/useAuth";
import type { ClientCallLog } from "@/types/database";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function waLink(phone: string) {
  const digits = phone.replace(/\D/g, "").replace(/^0/, "972");
  return `https://wa.me/${digits}`;
}

type ClientItem = {
  kind: "active" | "pending";
  id: string | null; // profile id (active only)
  email: string;
  full_name: string | null;
  business_name: string | null;
  phone: string | null;
  enrolled: boolean; // approved into the referral program
  inviteSentAt: string | null; // last welcome-email send (pending invitees)
  lastSeen?: string | null; // last real login (active clients)
};

export default function Clients() {
  const { data, isLoading, isError } = useClients();
  const [editTarget, setEditTarget] = useState<ClientItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientItem | null>(null);

  // Authoritative last-login per user (from auth.users), for the "כניסה אחרונה" line.
  const { data: activity } = useQuery({
    queryKey: ["admin-user-activity"],
    queryFn: async () => {
      const { data } = await supabase.rpc("admin_user_activity");
      const m = new Map<string, string>();
      for (const a of (data ?? []) as { id: string; last_sign_in_at: string | null }[]) {
        if (a.last_sign_in_at) m.set(a.id, a.last_sign_in_at);
      }
      return m;
    },
  });

  return (
    <div>
      <PageHeader
        title="לקוחות"
        subtitle="הלקוחות שלך, מי שכבר נכנס ומי שעוד מחכה לכניסה ראשונה."
        actions={<AddClientDialog />}
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState icon={Users} title="טעינת הלקוחות נכשלה" />
      ) : !data?.active.length && !data?.pending.length ? (
        <EmptyState
          icon={Users}
          title="אין עדיין לקוחות"
          description="הוסף לקוח ראשון, וברגע שהוא יתחבר הוא יופיע כאן."
          action={<AddClientDialog />}
        />
      ) : (
        <div className="space-y-6">
          {data!.active.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                פעילים ({data!.active.length})
              </h2>
              {data!.active.map((c) => (
                <ClientRow
                  key={c.id}
                  item={{
                    kind: "active",
                    id: c.id,
                    email: c.email,
                    full_name: c.full_name,
                    business_name: c.business_name,
                    phone: c.phone,
                    enrolled: c.enrolled,
                    inviteSentAt: null,
                    lastSeen: activity?.get(c.id) ?? null,
                  }}
                  icon={Building2}
                  iconClass="bg-primary/15 text-primary"
                  badge={
                    c.enrolled ? (
                      <Badge variant="cyan">שותף</Badge>
                    ) : (
                      <Badge variant="success">פעיל</Badge>
                    )
                  }
                  onEdit={setEditTarget}
                  onDelete={setDeleteTarget}
                />
              ))}
            </section>
          )}

          {data!.pending.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                ממתינים לכניסה ראשונה ({data!.pending.length})
              </h2>
              {data!.pending.map((c) => (
                <ClientRow
                  key={c.email}
                  item={{
                    kind: "pending",
                    id: null,
                    email: c.email,
                    full_name: c.full_name,
                    business_name: c.business_name,
                    phone: null,
                    enrolled: false,
                    inviteSentAt: c.invite_sent_at,
                  }}
                  icon={Clock}
                  iconClass="bg-muted text-muted-foreground"
                  badge={<Badge variant="warning">ממתין</Badge>}
                  onEdit={setEditTarget}
                  onDelete={setDeleteTarget}
                />
              ))}
            </section>
          )}
        </div>
      )}

      <EditClientDialog
        target={editTarget}
        onClose={() => setEditTarget(null)}
      />
      <DeleteClientDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function ClientRow({
  item,
  icon: Icon,
  iconClass,
  badge,
  onEdit,
  onDelete,
}: {
  item: ClientItem;
  icon: typeof Building2;
  iconClass: string;
  badge: ReactNode;
  onEdit: (i: ClientItem) => void;
  onDelete: (i: ClientItem) => void;
}) {
  const qc = useQueryClient();
  const [resending, setResending] = useState(false);

  async function resendInvite() {
    setResending(true);
    const r = await sendInvite(item.email);
    setResending(false);
    if (r.ok) toast({ title: "ההזמנה נשלחה שוב ✓", variant: "success" });
    else toastError("שליחת ההזמנה נכשלה.");
    qc.invalidateQueries({ queryKey: ["clients"] });
  }

  return (
    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
          <Icon className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">
            {item.business_name || item.full_name || "ללא שם"}
          </p>
          <p className="flex items-center gap-1 font-mono-code text-xs text-muted-foreground">
            <span className="truncate">{item.email}</span>
            <CopyButton
              content={item.email}
              variant="ghost"
              size="icon"
              className="size-5 shrink-0 hover:text-foreground"
              toastMessage="האימייל הועתק"
              title="העתקת אימייל"
            />
          </p>
          {item.kind === "pending" && (
            <p className="mt-0.5 text-[11px]">
              {item.inviteSentAt ? (
                <span className="text-brand-green-base">
                  ✓ הזמנה נשלחה · {new Date(item.inviteSentAt).toLocaleDateString("he-IL")}
                </span>
              ) : (
                <span className="text-muted-foreground">טרם נשלחה הזמנה</span>
              )}
            </p>
          )}
          {item.kind === "active" && (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {item.lastSeen
                ? `כניסה אחרונה: ${new Date(item.lastSeen).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}`
                : "טרם נכנס"}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {badge}
        {item.kind === "pending" && (
          <Button
            variant="ghost"
            size="icon"
            aria-label={item.inviteSentAt ? "שלח הזמנה שוב" : "שלח הזמנה"}
            title={item.inviteSentAt ? "שלח הזמנה שוב" : "שלח הזמנה"}
            disabled={resending}
            onClick={resendInvite}
          >
            <Mail className="size-4" />
          </Button>
        )}
        {item.kind === "active" && item.id && (
          <Button variant="ghost" size="icon" aria-label="צפייה" asChild>
            <Link to={`/admin/clients/${item.id}`}>
              <Eye className="size-4" />
            </Link>
          </Button>
        )}
        <Button variant="ghost" size="icon" aria-label="עריכה" onClick={() => onEdit(item)}>
          <Pencil className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="מחיקה"
          className="text-destructive"
          onClick={() => onDelete(item)}
        >
          <Trash2 className="size-4" />
        </Button>
      </div>
    </Card>
  );
}

function EditClientDialog({
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
        const { error: bErr } = await supabase
          .from("client_brand")
          .upsert(
            { client_id: target.id!, business_name: clampText(form.business_name.trim(), 120) || null },
            { onConflict: "client_id" }
          );
        if (bErr) throw bErr;

        // Admin-private CRM info.
        const { error: nErr } = await supabase
          .from("admin_client_notes")
          .upsert(
            {
              client_id: target.id!,
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

function DeleteClientDialog({
  target,
  onClose,
}: {
  target: ClientItem | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    if (!target) return;
    setBusy(true);
    try {
      if (target.kind === "active") {
        // Removes the client and cascades their projects/files/etc.
        const { error } = await supabase.from("profiles").delete().eq("id", target.id!);
        if (error) throw error;
      }
      // In both cases drop the whitelist entry so access is revoked.
      await supabase
        .from("allowed_emails")
        .delete()
        .ilike("email", target.email);

      toast({ title: "הלקוח הוסר", variant: "success" });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      onClose();
    } catch {
      toastError("המחיקה נכשלה.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>מחיקת לקוח</DialogTitle>
          <DialogDescription>
            {target?.kind === "active"
              ? "פעולה זו תמחק את הלקוח ואת כל הפרויקטים, הקבצים וההודעות שלו. אי אפשר לבטל."
              : "פעולה זו תסיר את ההזמנה. הלקוח לא יוכל להתחבר עד שתוסיף אותו שוב."}
          </DialogDescription>
        </DialogHeader>

        <p className="rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground">
          {target?.business_name || target?.full_name || target?.email}
        </p>

        <DialogFooter>
          <Button variant="destructive" onClick={confirmDelete} disabled={busy}>
            <Trash2 className="size-4" />
            {busy ? "מוחק…" : "מחיקה"}
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
    const { error } = await supabase
      .from("client_call_logs")
      .insert({ client_id: clientId, summary, created_by: user?.id ?? null });
    setAdding(false);
    if (error) return toastError("הוספת הסיכום נכשלה.");
    setText("");
    qc.invalidateQueries({ queryKey: ["client-crm", clientId] });
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

function AddClientDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    business_name: "",
    gender: "" as "" | "male" | "female" | "other",
  });

  function update(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    const email = form.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      toastError("כתובת אימייל לא תקינה.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("allowed_emails").insert({
      email,
      role: "client",
      full_name: clampText(form.full_name.trim(), 120) || null,
      business_name: clampText(form.business_name.trim(), 120) || null,
      gender: form.gender || null,
    });
    setSaving(false);

    if (error) {
      toastError(
        error.code === "23505" ? "הלקוח כבר קיים במערכת." : "הוספת הלקוח נכשלה."
      );
      return;
    }

    // Auto-send the "ברוכים הבאים ל-Orion" invitation (non-blocking).
    const invite = await sendInvite(email);
    if (invite.ok) {
      toast({ title: "הלקוח נוסף וההזמנה נשלחה למייל ✓", variant: "success" });
    } else {
      toast({
        title: "הלקוח נוסף, שליחת ההזמנה נכשלה",
        description: "אפשר לשלוח שוב מרשימת הממתינים.",
        variant: "destructive",
      });
    }
    qc.invalidateQueries({ queryKey: ["clients"] });
    setForm({ full_name: "", email: "", business_name: "", gender: "" });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> הוספת לקוח
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>הוספת לקוח חדש</DialogTitle>
          <DialogDescription>
            הזן את כתובת המייל של הלקוח (Google או כל מייל). ברגע שהוא מתחבר בפעם
            הראשונה, הפרופיל שלו נוצר אוטומטית.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="c-name">שם מלא</Label>
            <Input
              id="c-name"
              value={form.full_name}
              maxLength={120}
              onChange={(e) => update("full_name", e.target.value)}
              placeholder="שם הלקוח"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-email">אימייל (Google או כל מייל)</Label>
            <Input
              id="c-email"
              dir="ltr"
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="client@gmail.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-business">שם העסק</Label>
            <Input
              id="c-business"
              value={form.business_name}
              maxLength={120}
              onChange={(e) => update("business_name", e.target.value)}
              placeholder="שם העסק של הלקוח"
            />
          </div>
          <div className="space-y-1.5">
            <Label>מין (להתאמת ניסוח)</Label>
            <SelectMenu
              variant="field"
              ariaLabel="מין"
              value={form.gender}
              onChange={(v) => update("gender", v)}
              options={GENDER_OPTIONS}
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={saving}>
            <UserPlus className="size-4" />
            {saving ? "מוסיף…" : "הוספה"}
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
