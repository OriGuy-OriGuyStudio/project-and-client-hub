import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Eye, Handshake, Mail, Pencil, Plus, Trash2, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectMenu } from "@/components/ui/select-menu";
import { GENDER_OPTIONS } from "@/lib/gender";
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
import { cn } from "@/lib/utils";
import { usePartners, rateLabel, type ActivePartner } from "@/hooks/usePartners";
import { isDemoEmail } from "@/lib/demo";
import { DemoAccountControls } from "@/components/admin/DemoAccountControls";
import { sendInvite } from "@/lib/invite";
import { referralUrl } from "@/lib/referral";
import type { AllowedEmail, Gender } from "@/types/database";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Normalized edit/delete target for both active partners and pending invites. */
type PartnerTarget = {
  kind: "active" | "pending";
  id: string | null;
  email: string;
  full_name: string | null;
  gender: Gender | null;
  commission_rate: number | null;
  commission_rate_min: number | null;
  commission_rate_max: number | null;
  commission_notes: string | null;
};

function toTarget(p: ActivePartner | AllowedEmail, kind: "active" | "pending"): PartnerTarget {
  return {
    kind,
    id: "id" in p ? (p as ActivePartner).id : null,
    email: p.email,
    full_name: p.full_name,
    gender: p.gender,
    commission_rate: p.commission_rate,
    commission_rate_min: p.commission_rate_min,
    commission_rate_max: p.commission_rate_max,
    commission_notes: p.commission_notes,
  };
}

export default function Partners() {
  const { data, isLoading, isError } = usePartners();
  const [editTarget, setEditTarget] = useState<PartnerTarget | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PartnerTarget | null>(null);

  // Authoritative last-login per partner (from auth.users), for "כניסה אחרונה".
  const { data: lastSeen } = useQuery({
    queryKey: ["admin-user-activity"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_user_activity");
      // Surface RPC failures instead of silently showing everyone as "טרם נכנס".
      if (error) throw error;
      const m = new Map<string, string>();
      for (const a of (data ?? []) as { id: string; last_sign_in_at: string | null }[]) {
        if (a.last_sign_in_at) m.set(a.id, a.last_sign_in_at);
      }
      return m;
    },
  });

  const activeList = data?.active ?? [];
  const pendingList = data?.pending ?? [];
  const realActive = activeList.filter((p) => !isDemoEmail(p.email));
  const demoActive = activeList.filter((p) => isDemoEmail(p.email));
  const realPending = pendingList.filter((p) => !isDemoEmail(p.email));
  const demoPending = pendingList.filter((p) => isDemoEmail(p.email));
  const hasDemo = demoActive.length + demoPending.length > 0;

  const renderActivePartner = (p: ActivePartner) => (
    <Card key={p.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <Handshake className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{p.full_name || "ללא שם"}</p>
          <p className="flex flex-wrap items-center gap-x-1 gap-y-0.5 font-mono-code text-xs text-muted-foreground">
            <span className="max-w-full truncate">{p.email}</span>
            <CopyButton content={p.email} variant="ghost" size="icon"
              className="size-5 shrink-0 hover:text-foreground" toastMessage="האימייל הועתק" title="העתקת אימייל" />
            {p.referral_code && (
              <>
                <span>· ref/{p.referral_code}</span>
                <CopyButton content={referralUrl(p.referral_code)} variant="ghost" size="icon"
                  className="size-5 shrink-0 hover:text-foreground" toastMessage="לינק ההפניה הועתק" title="העתקת לינק הפניה" />
              </>
            )}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {lastSeen?.get(p.id)
              ? `פעילות אחרונה: ${new Date(lastSeen.get(p.id)!).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}`
              : "טרם נכנס"}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Badge variant="success">
          {rateLabel(p.commission_rate, p.commission_rate_min, p.commission_rate_max)}
        </Badge>
        <Button variant="ghost" size="icon" aria-label="צפייה" asChild>
          <Link to={`/admin/partners/${p.id}`}>
            <Eye className="size-4" />
          </Link>
        </Button>
        <Button variant="ghost" size="icon" aria-label="עריכה" onClick={() => setEditTarget(toTarget(p, "active"))}>
          <Pencil className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="מחיקה" className="text-destructive"
          onClick={() => setDeleteTarget(toTarget(p, "active"))}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </Card>
  );

  return (
    <div>
      <PageHeader
        title="שותפים"
        subtitle="שותפים שמפנים אליך לידים, ואחוז העמלה של כל אחד."
        actions={<AddPartnerDialog />}
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-2xl" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState icon={Handshake} title="טעינת השותפים נכשלה" />
      ) : !data?.active.length && !data?.pending.length ? (
        <EmptyState
          icon={Handshake}
          title="אין עדיין שותפים"
          description="הוסף שותף ראשון, הגדר לו אחוז עמלה, וברגע שיתחבר הוא יקבל לינק הפניה."
          action={<AddPartnerDialog />}
        />
      ) : (
        <div className="space-y-6">
          {realActive.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                פעילים ({realActive.length})
              </h2>
              {realActive.map(renderActivePartner)}
            </section>
          )}

          {realPending.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                ממתינים לכניסה ראשונה ({realPending.length})
              </h2>
              {realPending.map((p) => (
                <PendingPartnerRow
                  key={p.email}
                  p={p}
                  onEdit={() => setEditTarget(toTarget(p, "pending"))}
                  onDelete={() => setDeleteTarget(toTarget(p, "pending"))}
                />
              ))}
            </section>
          )}

          {hasDemo && (
            <section className="space-y-2 rounded-2xl border border-dashed border-border/60 bg-background/20 p-3">
              <h2 className="text-sm font-medium text-amber-500">
                טסטים (דמה) , לא נספרים כשותפים אמיתיים
              </h2>
              {demoActive.map((p) => (
                <div key={p.id} className="space-y-1">
                  {renderActivePartner(p)}
                  <DemoAccountControls
                    demoId={p.id}
                    role="partner"
                    sources={realActive.map((r) => ({
                      id: r.id,
                      label: r.full_name || r.email,
                    }))}
                  />
                </div>
              ))}
              {demoPending.length > 0 && (
                <>
                  {demoPending.map((p) => (
                    <PendingPartnerRow
                      key={p.email}
                      p={p}
                      onEdit={() => setEditTarget(toTarget(p, "pending"))}
                      onDelete={() => setDeleteTarget(toTarget(p, "pending"))}
                    />
                  ))}
                  <p className="ps-1 text-xs text-muted-foreground">
                    התחבר פעם אחת עם חשבון הדמה כדי להפעיל את טעינת הנתונים.
                  </p>
                </>
              )}
            </section>
          )}
        </div>
      )}

      <EditPartnerDialog target={editTarget} onClose={() => setEditTarget(null)} />
      <DeletePartnerDialog target={deleteTarget} onClose={() => setDeleteTarget(null)} />
    </div>
  );
}

/** A whitelisted partner who hasn't signed in yet — shows invite status + resend. */
function PendingPartnerRow({
  p,
  onEdit,
  onDelete,
}: {
  p: AllowedEmail;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const qc = useQueryClient();
  const [resending, setResending] = useState(false);

  async function resend() {
    setResending(true);
    const r = await sendInvite(p.email);
    setResending(false);
    if (r.ok) toast({ title: "ההזמנה נשלחה שוב ✓", variant: "success" });
    else toastError("שליחת ההזמנה נכשלה.");
    qc.invalidateQueries({ queryKey: ["partners"] });
  }

  return (
    <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Clock className="size-5" />
        </span>
        <div className="min-w-0">
          <p className="font-medium text-foreground">{p.full_name || "ללא שם"}</p>
          <p className="flex items-center gap-1 font-mono-code text-xs text-muted-foreground">
            <span className="truncate">{p.email}</span>
            <CopyButton
              content={p.email}
              variant="ghost"
              size="icon"
              className="size-5 shrink-0 hover:text-foreground"
              toastMessage="האימייל הועתק"
              title="העתקת אימייל"
            />
          </p>
          <p className="mt-0.5 text-[11px]">
            {p.invite_sent_at ? (
              <span className="text-brand-green-base">
                ✓ הזמנה נשלחה · {new Date(p.invite_sent_at).toLocaleDateString("he-IL")}
              </span>
            ) : (
              <span className="text-muted-foreground">טרם נשלחה הזמנה</span>
            )}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Badge variant="warning">
          {rateLabel(p.commission_rate, p.commission_rate_min, p.commission_rate_max)}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          aria-label={p.invite_sent_at ? "שלח הזמנה שוב" : "שלח הזמנה"}
          title={p.invite_sent_at ? "שלח הזמנה שוב" : "שלח הזמנה"}
          disabled={resending}
          onClick={resend}
        >
          <Mail className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="עריכה" onClick={onEdit}>
          <Pencil className="size-4" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="מחיקה" className="text-destructive" onClick={onDelete}>
          <Trash2 className="size-4" />
        </Button>
      </div>
    </Card>
  );
}

/** Edit a partner — commission (fixed/range) + notes + name; pending edits the whitelist row. */
function EditPartnerDialog({ target, onClose }: { target: PartnerTarget | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [seeded, setSeeded] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    gender: "" as "" | "male" | "female" | "other",
    mode: "fixed" as "fixed" | "range",
    commission_rate: "5",
    commission_min: "5",
    commission_max: "7.5",
    commission_notes: "",
  });

  if (target) {
    const key = `${target.kind}:${target.email}`;
    if (key !== seeded) {
      const isRange =
        target.commission_rate_min != null &&
        target.commission_rate_max != null &&
        target.commission_rate_min !== target.commission_rate_max;
      setForm({
        full_name: target.full_name ?? "",
        gender: (target.gender ?? "") as "" | "male" | "female" | "other",
        mode: isRange ? "range" : "fixed",
        commission_rate: String(target.commission_rate ?? 5),
        commission_min: String(target.commission_rate_min ?? target.commission_rate ?? 5),
        commission_max: String(target.commission_rate_max ?? target.commission_rate ?? 7.5),
        commission_notes: target.commission_notes ?? "",
      });
      setSeeded(key);
    }
  }

  function update(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    if (!target) return;
    let rate: number, min: number, max: number;
    if (form.mode === "fixed") {
      rate = Number(form.commission_rate);
      if (Number.isNaN(rate) || rate < 0 || rate > 100) return toastError("אחוז עמלה לא תקין.");
      min = rate;
      max = rate;
    } else {
      min = Number(form.commission_min);
      max = Number(form.commission_max);
      if ([min, max].some((n) => Number.isNaN(n) || n < 0 || n > 100) || min > max)
        return toastError("טווח אחוזים לא תקין.");
      rate = min;
    }

    setSaving(true);
    const fullName = clampText(form.full_name.trim(), 120) || null;
    const notes = clampText(form.commission_notes.trim(), 500) || null;
    try {
      if (target.kind === "active") {
        const { error: pErr } = await supabase
          .from("profiles")
          .update({ full_name: fullName, gender: form.gender || null })
          .eq("id", target.id!);
        if (pErr) throw pErr;
        const { error: ppErr } = await supabase
          .from("partner_profiles")
          .update({
            commission_rate: rate,
            commission_rate_min: min,
            commission_rate_max: max,
            commission_notes: notes,
          })
          .eq("id", target.id!);
        if (ppErr) throw ppErr;
      } else {
        const { error } = await supabase
          .from("allowed_emails")
          .update({
            full_name: fullName,
            gender: form.gender || null,
            commission_rate: rate,
            commission_rate_min: min,
            commission_rate_max: max,
            commission_notes: notes,
          })
          .ilike("email", target.email);
        if (error) throw error;
      }
      toast({ title: "פרטי השותף עודכנו", variant: "success" });
      qc.invalidateQueries({ queryKey: ["partners"] });
      qc.invalidateQueries({ queryKey: ["partner-detail", target.id] });
      setSeeded(null);
      onClose();
    } catch {
      toastError("שמירת השינויים נכשלה.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && (setSeeded(null), onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>עריכת שותף</DialogTitle>
          <DialogDescription>{target?.email}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ep-name">שם מלא</Label>
            <Input id="ep-name" value={form.full_name} maxLength={120}
              onChange={(e) => update("full_name", e.target.value)} placeholder="שם השותף" />
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
          <div className="space-y-2">
            <Label>אחוז עמלה</Label>
            <div className="flex gap-2">
              <button type="button" onClick={() => update("mode", "fixed")}
                className={cn("flex-1 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  form.mode === "fixed" ? "border-primary/50 bg-primary/15 text-primary" : "border-border text-muted-foreground")}>
                אחוז קבוע
              </button>
              <button type="button" onClick={() => update("mode", "range")}
                className={cn("flex-1 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  form.mode === "range" ? "border-primary/50 bg-primary/15 text-primary" : "border-border text-muted-foreground")}>
                טווח
              </button>
            </div>
            {form.mode === "fixed" ? (
              <Input dir="ltr" type="number" step="0.5" min="0" max="100"
                value={form.commission_rate}
                onChange={(e) => update("commission_rate", e.target.value)} placeholder="%" />
            ) : (
              <div className="flex items-center gap-2">
                <Input dir="ltr" type="number" step="0.5" min="0" max="100"
                  value={form.commission_min}
                  onChange={(e) => update("commission_min", e.target.value)} placeholder="מ-%" />
                <span className="text-muted-foreground">–</span>
                <Input dir="ltr" type="number" step="0.5" min="0" max="100"
                  value={form.commission_max}
                  onChange={(e) => update("commission_max", e.target.value)} placeholder="עד-%" />
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ep-notes">הערה פרטית</Label>
            <Textarea id="ep-notes" value={form.commission_notes} maxLength={500}
              onChange={(e) => update("commission_notes", e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={saving}>{saving ? "שומר…" : "שמירה"}</Button>
          <Button variant="ghost" onClick={() => (setSeeded(null), onClose())}>ביטול</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Delete a partner — active removes the profile (cascades leads), pending removes the invite. */
function DeletePartnerDialog({ target, onClose }: { target: PartnerTarget | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    if (!target) return;
    setBusy(true);
    try {
      if (target.kind === "active") {
        const { error } = await supabase.from("profiles").delete().eq("id", target.id!);
        if (error) throw error;
      }
      await supabase.from("allowed_emails").delete().ilike("email", target.email);
      toast({ title: "השותף הוסר", variant: "success" });
      qc.invalidateQueries({ queryKey: ["partners"] });
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
          <DialogTitle>מחיקת שותף</DialogTitle>
          <DialogDescription>
            {target?.kind === "active"
              ? "פעולה זו תמחק את השותף ואת כל הלידים והעסקאות שלו. אי אפשר לבטל."
              : "פעולה זו תסיר את ההזמנה. השותף לא יוכל להתחבר עד שתוסיף אותו שוב."}
          </DialogDescription>
        </DialogHeader>

        <p className="rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground">
          {target?.full_name || target?.email}
        </p>

        <DialogFooter>
          <Button variant="destructive" onClick={confirmDelete} disabled={busy}>
            <Trash2 className="size-4" />
            {busy ? "מוחק…" : "מחיקה"}
          </Button>
          <Button variant="ghost" onClick={onClose}>ביטול</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddPartnerDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    gender: "" as "" | "male" | "female" | "other",
    mode: "fixed" as "fixed" | "range",
    commission_rate: "5",
    commission_min: "5",
    commission_max: "7.5",
    commission_notes: "",
  });

  function update(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function reset() {
    setForm({
      full_name: "",
      email: "",
      gender: "",
      mode: "fixed",
      commission_rate: "5",
      commission_min: "5",
      commission_max: "7.5",
      commission_notes: "",
    });
  }

  async function save() {
    const email = form.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return toastError("כתובת אימייל לא תקינה.");

    let rate: number, min: number, max: number;
    if (form.mode === "fixed") {
      rate = Number(form.commission_rate);
      if (Number.isNaN(rate) || rate < 0 || rate > 100)
        return toastError("אחוז עמלה לא תקין.");
      min = rate;
      max = rate;
    } else {
      min = Number(form.commission_min);
      max = Number(form.commission_max);
      if ([min, max].some((n) => Number.isNaN(n) || n < 0 || n > 100) || min > max)
        return toastError("טווח אחוזים לא תקין.");
      rate = min;
    }

    setSaving(true);
    const { error } = await supabase.from("allowed_emails").insert({
      email,
      role: "partner",
      full_name: clampText(form.full_name.trim(), 120) || null,
      gender: form.gender || null,
      commission_rate: rate,
      commission_rate_min: min,
      commission_rate_max: max,
      commission_notes: clampText(form.commission_notes.trim(), 500) || null,
    });
    if (error) {
      setSaving(false);
      toastError(error.code === "23505" ? "המשתמש כבר קיים." : "הוספת השותף נכשלה.");
      return;
    }

    // Auto-send the "ברוכים הבאים ל-Orion" invitation. Keep the button in its
    // "מוסיף…" state through this — sending the email can take a few seconds.
    const invite = await sendInvite(email);
    if (invite.ok) {
      toast({ title: "השותף נוסף וההזמנה נשלחה למייל ✓", variant: "success" });
    } else {
      toast({
        title: "השותף נוסף, שליחת ההזמנה נכשלה",
        description: "אפשר לשלוח שוב מרשימת הממתינים.",
        variant: "destructive",
      });
    }
    qc.invalidateQueries({ queryKey: ["partners"] });
    reset();
    setOpen(false);
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> הוספת שותף
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>הוספת שותף חדש</DialogTitle>
          <DialogDescription>
            הגדר את אחוז העמלה. ברגע שהשותף יתחבר (עם Google או קישור למייל), ייווצר
            לו לינק הפניה אישי.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pt-name">שם מלא</Label>
            <Input id="pt-name" value={form.full_name} maxLength={120}
              onChange={(e) => update("full_name", e.target.value)} placeholder="שם השותף" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pt-email">אימייל (Google או כל מייל)</Label>
            <Input id="pt-email" dir="ltr" type="email" value={form.email}
              onChange={(e) => update("email", e.target.value)} placeholder="partner@example.com" />
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
          <div className="space-y-2">
            <Label>אחוז עמלה</Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => update("mode", "fixed")}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  form.mode === "fixed"
                    ? "border-primary/50 bg-primary/15 text-primary"
                    : "border-border text-muted-foreground"
                )}
              >
                אחוז קבוע
              </button>
              <button
                type="button"
                onClick={() => update("mode", "range")}
                className={cn(
                  "flex-1 rounded-lg border px-3 py-1.5 text-sm transition-colors",
                  form.mode === "range"
                    ? "border-primary/50 bg-primary/15 text-primary"
                    : "border-border text-muted-foreground"
                )}
              >
                טווח
              </button>
            </div>
            {form.mode === "fixed" ? (
              <Input dir="ltr" type="number" step="0.5" min="0" max="100"
                value={form.commission_rate}
                onChange={(e) => update("commission_rate", e.target.value)} placeholder="%" />
            ) : (
              <div className="flex items-center gap-2">
                <Input dir="ltr" type="number" step="0.5" min="0" max="100"
                  value={form.commission_min}
                  onChange={(e) => update("commission_min", e.target.value)} placeholder="מ-%" />
                <span className="text-muted-foreground">–</span>
                <Input dir="ltr" type="number" step="0.5" min="0" max="100"
                  value={form.commission_max}
                  onChange={(e) => update("commission_max", e.target.value)} placeholder="עד-%" />
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pt-notes">הערה פרטית</Label>
            <Textarea id="pt-notes" value={form.commission_notes} maxLength={500}
              onChange={(e) => update("commission_notes", e.target.value)}
              placeholder="למשל: הסכמנו על 7.5% לפרויקטים מעל 10K" />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={saving}>
            <UserPlus className="size-4" />
            {saving ? "מוסיף…" : "הוספה"}
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>ביטול</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
