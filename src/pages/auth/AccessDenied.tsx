import { useState } from "react";
import { ShieldAlert, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { toast, toastError } from "@/hooks/use-toast";
import { clampText } from "@/lib/sanitize";

export default function AccessDenied() {
  const { signOut, user } = useAuth();
  const [form, setForm] = useState({ full_name: "", business_name: "", phone: "", message: "" });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit() {
    const full_name = clampText(form.full_name.trim(), 120);
    if (!full_name) return toastError("צריך לפחות שם מלא.");
    setSending(true);
    const { error } = await supabase.from("access_requests").insert({
      email: user?.email ?? "",
      full_name,
      business_name: clampText(form.business_name.trim(), 160) || null,
      phone: clampText(form.phone.trim(), 40) || null,
      message: clampText(form.message.trim(), 1000) || null,
    });
    setSending(false);
    if (error) return toastError("שליחת הבקשה נכשלה. נסה שוב.");
    setSent(true);
    toast({ title: "הבקשה נשלחה לאורי 🎉", variant: "success" });
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        {sent ? (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <CheckCircle2 className="size-8" />
            </div>
            <div className="space-y-2">
              <h1 className="font-heading text-2xl font-black text-foreground">הבקשה נשלחה</h1>
              <p className="mx-auto max-w-sm text-muted-foreground">
                אורי קיבל את הפרטים שלך ויפתח לך גישה בהקדם. תקבל הודעה כשהכל מוכן.
              </p>
            </div>
            <Button variant="secondary" onClick={() => signOut()}>
              התנתקות
            </Button>
          </>
        ) : (
          <>
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
              <ShieldAlert className="size-8" />
            </div>
            <div className="space-y-2">
              <h1 className="font-heading text-2xl font-black text-foreground">עדיין אין לך גישה</h1>
              <p className="mx-auto max-w-sm text-muted-foreground">
                הגישה שמורה ללקוחות שלי. אם תרצה שאפתח לך כרטיס, מלא את הפרטים ואחזור אליך.
              </p>
              {user?.email && (
                <p className="font-mono-code text-xs text-muted-foreground">{user.email}</p>
              )}
            </div>

            <div className="w-full space-y-3 text-start">
              <div className="space-y-1.5">
                <Label htmlFor="ad-name">שם מלא</Label>
                <Input
                  id="ad-name"
                  value={form.full_name}
                  maxLength={120}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ad-biz">שם העסק</Label>
                <Input
                  id="ad-biz"
                  value={form.business_name}
                  maxLength={160}
                  onChange={(e) => setForm((f) => ({ ...f, business_name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ad-phone">טלפון</Label>
                <Input
                  id="ad-phone"
                  dir="ltr"
                  value={form.phone}
                  maxLength={40}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ad-msg">הודעה (לא חובה)</Label>
                <Textarea
                  id="ad-msg"
                  value={form.message}
                  maxLength={1000}
                  onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                />
              </div>
              <Button className="w-full" onClick={submit} disabled={sending}>
                {sending ? "שולח…" : "שליחת בקשה לגישה"}
              </Button>
            </div>

            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              התנתקות
            </Button>
          </>
        )}
      </div>
    </main>
  );
}
