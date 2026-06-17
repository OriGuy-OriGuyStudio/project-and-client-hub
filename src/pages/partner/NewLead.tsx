import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectMenu } from "@/components/ui/select-menu";
import { supabase } from "@/lib/supabase";
import { toastError } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { clampText } from "@/lib/sanitize";
import { isEmail, isPhone } from "@/lib/validation";
import { projectTypeHe } from "@/lib/status";
import type { PartnerProjectType } from "@/types/database";

const TYPES: PartnerProjectType[] = ["business_site", "ecommerce", "system", "other"];

export default function NewLead() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({
    lead_name: "",
    lead_phone: "",
    lead_email: "",
    project_type: "business_site" as PartnerProjectType,
    notes: "",
    quote_requested: false,
  });

  function update<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    const name = clampText(form.lead_name.trim(), 120);
    const phone = form.lead_phone.trim();
    const email = form.lead_email.trim();
    if (!name) return toastError("צריך שם של הליד.");
    if (!phone && !email) return toastError("צריך טלפון או מייל ליצירת קשר.");
    if (phone && !isPhone(phone)) return toastError("מספר הטלפון לא תקין.");
    if (email && !isEmail(email)) return toastError("כתובת המייל לא תקינה.");

    setSaving(true);
    const { error } = await supabase.from("partner_leads").insert({
      partner_id: user!.id,
      lead_name: name,
      lead_phone: clampText(phone, 40) || null,
      lead_email: clampText(email, 160) || null,
      project_type: form.project_type,
      notes: clampText(form.notes.trim(), 2000) || null,
      quote_requested: form.quote_requested,
    });
    setSaving(false);
    if (error) return toastError("שליחת הליד נכשלה.");

    qc.invalidateQueries({ queryKey: ["partner-me"] });
    setDone(true);
  }

  if (done) {
    return (
      <div>
        <PageHeader title="הגשת ליד" />
        <Card className="flex flex-col items-center gap-4 p-10 text-center">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <CheckCircle2 className="size-7" />
          </span>
          <div className="space-y-1">
            <h2 className="font-heading text-xl font-black text-foreground">קיבלתי 🙌</h2>
            <p className="text-muted-foreground">אחזור אליך תוך 24 שעות עם עדכון.</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate("/partner-portal")}>חזרה ללוח</Button>
            <Button
              variant="secondary"
              onClick={() => {
                setDone(false);
                setForm({
                  lead_name: "",
                  lead_phone: "",
                  lead_email: "",
                  project_type: "business_site",
                  notes: "",
                  quote_requested: false,
                });
              }}
            >
              הגשת ליד נוסף
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="הגשת ליד" subtitle="פרטי הלקוח הפוטנציאלי שאתה מפנה לסטודיו." />
      <Card className="space-y-4 p-6">
        <div className="space-y-1.5">
          <Label htmlFor="l-name">שם הלקוח הפוטנציאלי</Label>
          <Input id="l-name" value={form.lead_name} maxLength={120}
            onChange={(e) => update("lead_name", e.target.value)} placeholder="שם מלא" />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="l-phone">טלפון</Label>
            <Input id="l-phone" dir="ltr" value={form.lead_phone} maxLength={40}
              onChange={(e) => update("lead_phone", e.target.value)} placeholder="05X-XXXXXXX" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="l-email">מייל</Label>
            <Input id="l-email" dir="ltr" type="email" value={form.lead_email} maxLength={160}
              onChange={(e) => update("lead_email", e.target.value)} placeholder="name@example.com" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="l-type">סוג פרויקט</Label>
          <SelectMenu
            id="l-type"
            variant="field"
            ariaLabel="סוג פרויקט"
            value={form.project_type}
            onChange={(v) => update("project_type", v)}
            options={TYPES.map((t) => ({ value: t, label: projectTypeHe[t] }))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="l-notes">הערה</Label>
          <Textarea id="l-notes" value={form.notes} maxLength={2000}
            onChange={(e) => update("notes", e.target.value)} placeholder="כל מה שכדאי שאדע על הלקוח או הפרויקט" />
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
          <input type="checkbox" checked={form.quote_requested}
            onChange={(e) => update("quote_requested", e.target.checked)}
            className="size-4 accent-[var(--primary)]" />
          אני רוצה שתכין הצעת מחיר עבור הלקוח הזה
        </label>
        <div className="flex justify-end pt-2">
          <Button onClick={submit} disabled={saving}>
            {saving ? "שולח…" : "שליחת ליד"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
