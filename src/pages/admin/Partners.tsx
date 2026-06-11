import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Clock, Handshake, Percent, Plus, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
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
import { usePartners, rateLabel } from "@/hooks/usePartners";
import { AdminLeadsSection } from "@/components/partner/AdminLeadsSection";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Partners() {
  const { data, isLoading, isError } = usePartners();

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
          {data!.active.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                פעילים ({data!.active.length})
              </h2>
              {data!.active.map((p) => (
                <Card key={p.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <Handshake className="size-5" />
                    </span>
                    <div>
                      <p className="font-medium text-foreground">{p.full_name || "ללא שם"}</p>
                      <p className="font-mono-code text-xs text-muted-foreground">
                        {p.email}
                        {p.referral_code ? ` · ref/${p.referral_code}` : ""}
                      </p>
                    </div>
                  </div>
                  <Badge variant="success">
                    <Percent className="size-3" />
                    {rateLabel(p.commission_rate, p.commission_rate_min, p.commission_rate_max)}
                  </Badge>
                </Card>
              ))}
            </section>
          )}

          {data!.pending.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                ממתינים לכניסה ראשונה ({data!.pending.length})
              </h2>
              {data!.pending.map((p) => (
                <Card key={p.email} className="flex items-center justify-between gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                      <Clock className="size-5" />
                    </span>
                    <div>
                      <p className="font-medium text-foreground">{p.full_name || "ללא שם"}</p>
                      <p className="font-mono-code text-xs text-muted-foreground">{p.email}</p>
                    </div>
                  </div>
                  <Badge variant="warning">
                    <Percent className="size-3" />
                    {rateLabel(p.commission_rate, p.commission_rate_min, p.commission_rate_max)}
                  </Badge>
                </Card>
              ))}
            </section>
          )}
        </div>
      )}

      <div className="mt-8">
        <AdminLeadsSection />
      </div>
    </div>
  );
}

function AddPartnerDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
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
      commission_rate: rate,
      commission_rate_min: min,
      commission_rate_max: max,
      commission_notes: clampText(form.commission_notes.trim(), 500) || null,
    });
    setSaving(false);
    if (error) {
      toastError(error.code === "23505" ? "המשתמש כבר קיים." : "הוספת השותף נכשלה.");
      return;
    }
    toast({ title: "השותף נוסף", variant: "success" });
    qc.invalidateQueries({ queryKey: ["partners"] });
    reset();
    setOpen(false);
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
            הגדר את אחוז העמלה. ברגע שהשותף יתחבר עם Google, ייווצר לו לינק הפניה
            אישי.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="pt-name">שם מלא</Label>
            <Input id="pt-name" value={form.full_name} maxLength={120}
              onChange={(e) => update("full_name", e.target.value)} placeholder="שם השותף" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pt-email">אימייל (Google)</Label>
            <Input id="pt-email" dir="ltr" type="email" value={form.email}
              onChange={(e) => update("email", e.target.value)} placeholder="partner@gmail.com" />
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
