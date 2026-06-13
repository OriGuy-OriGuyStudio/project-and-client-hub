import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MessageSquareHeart, Send, UserCircle } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";
import { toast, toastError } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useMyFeedback, feedbackStatusHe } from "@/hooks/useClientFeedback";
import { useCuriousBadge } from "@/hooks/useCuriousBadge";
import { clampText } from "@/lib/sanitize";

export default function Profile() {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const { data: feedback, isLoading } = useMyFeedback();
  const { data: isCurious } = useCuriousBadge();
  const [savingProfile, setSavingProfile] = useState(false);
  const [name, setName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);

  async function saveProfile() {
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: clampText(name.trim(), 120) || null,
        phone: clampText(phone.trim(), 40) || null,
      })
      .eq("id", user!.id);
    setSavingProfile(false);
    if (error) return toastError("שמירת הפרטים נכשלה.");
    toast({ title: "הפרטים נשמרו", variant: "success" });
  }

  async function sendFeedback() {
    const message = clampText(msg.trim(), 2000);
    if (!message) return;
    setSending(true);
    const { error } = await supabase
      .from("client_feedback")
      .insert({ client_id: user!.id, message });
    setSending(false);
    if (error) return toastError("שליחת ההערה נכשלה.");
    toast({ title: "תודה! ההערה נשלחה 🙏", variant: "success" });
    setMsg("");
    qc.invalidateQueries({ queryKey: ["my-feedback"] });
  }

  return (
    <div className="space-y-6">
      <PageHeader title="פרופיל" subtitle="הפרטים שלך, וקשר ישיר איתי." />

      {/* Personal details */}
      <Card className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <UserCircle className="size-5 text-brand-cyan-base" />
          <h2 className="font-heading text-lg font-semibold text-foreground">הפרטים שלי</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="p-name">שם מלא</Label>
            <Input id="p-name" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-phone">טלפון</Label>
            <Input id="p-phone" dir="ltr" value={phone} maxLength={40} onChange={(e) => setPhone(e.target.value)} />
          </div>
        </div>
        {user?.email && (
          <p className="flex items-center gap-1 font-mono-code text-xs text-muted-foreground">
            <span className="truncate">{user.email}</span>
            <CopyButton
              content={user.email}
              variant="ghost"
              size="icon"
              className="size-5 shrink-0 hover:text-foreground"
              toastMessage="האימייל הועתק"
              title="העתקת אימייל"
            />
          </p>
        )}
        {isCurious && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">תגים:</span>
            <Badge variant="success" title="גילית את הסוד הנסתר בפורטל">
              🔭 סקרן
            </Badge>
          </div>
        )}
        <div className="flex justify-end">
          <Button onClick={saveProfile} disabled={savingProfile}>
            {savingProfile ? "שומר…" : "שמירה"}
          </Button>
        </div>
      </Card>

      {/* Interface feedback */}
      <Card className="space-y-4 p-5">
        <div className="flex items-center gap-2">
          <MessageSquareHeart className="size-5 text-brand-cyan-base" />
          <h2 className="font-heading text-lg font-semibold text-foreground">
            הערות לשיפור הממשק
          </h2>
        </div>
        <p className="text-sm text-muted-foreground">
          משהו לא נוח? חסר לך משהו? כתוב לי ואקרא כל הערה. זה עוזר לי לשפר את
          הפורטל בשבילך.
        </p>
        <div className="space-y-3">
          <Textarea
            value={msg}
            maxLength={2000}
            onChange={(e) => setMsg(e.target.value)}
            placeholder="ההערה שלך…"
          />
          <div className="flex justify-end">
            <Button onClick={sendFeedback} disabled={sending}>
              <Send className="size-4" /> שליחה
            </Button>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-16 w-full rounded-xl" />
        ) : feedback && feedback.length > 0 ? (
          <div className="space-y-2 pt-2">
            {feedback.map((f) => (
              <div key={f.id} className="rounded-xl border border-border bg-background/30 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-foreground">{f.message}</p>
                  <Badge
                    variant={
                      f.status === "resolved" ? "success" : f.status === "in_progress" ? "warning" : "secondary"
                    }
                  >
                    {feedbackStatusHe[f.status]}
                  </Badge>
                </div>
                {f.admin_reply && (
                  <p className="mt-2 rounded-lg bg-primary/10 px-3 py-2 text-sm text-foreground">
                    <span className="font-medium text-primary">אורי:</span> {f.admin_reply}
                  </p>
                )}
                <p className="mt-1 text-[11px] text-muted-foreground/70">
                  {new Date(f.created_at).toLocaleDateString("he-IL")}
                </p>
              </div>
            ))}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
