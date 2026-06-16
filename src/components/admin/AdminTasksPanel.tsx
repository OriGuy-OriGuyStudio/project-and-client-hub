import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Check, X, Gift, MessagesSquare, ExternalLink, Send, CheckCircle2, UserPlus, Phone, Handshake } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabase";
import { sendRedemptionNotice } from "@/lib/invite";
import { toast, toastError } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useAdminTasks, type AdminTaskRedemption } from "@/hooks/useAdminTasks";

const PROJECT_TYPE_HE: Record<string, string> = {
  business_site: "אתר תדמית",
  ecommerce: "חנות אונליין",
  system: "מערכת",
  other: "אחר",
};

export function AdminTasksPanel() {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useAdminTasks(profile?.id);
  const [busy, setBusy] = useState<string | null>(null);
  const [replies, setReplies] = useState<Record<string, string>>({});

  const redemptions = data?.redemptions ?? [];
  const messages = data?.messages ?? [];
  const accessRequests = data?.accessRequests ?? [];
  const leads = data?.leads ?? [];
  const total = redemptions.length + messages.length + accessRequests.length + leads.length;

  async function decideAccess(id: string, approve: boolean) {
    setBusy(id);
    const { error } = approve
      ? await supabase.rpc("approve_access_request", { p_id: id, p_role: "client" })
      : await supabase.rpc("reject_access_request", { p_id: id });
    setBusy(null);
    if (error) return toastError(error.message || "הפעולה נכשלה.");
    toast({
      title: approve ? "הלקוח הוקם ✓ עכשיו הוא יכול להתחבר" : "הבקשה נדחתה",
      variant: "success",
    });
    qc.invalidateQueries({ queryKey: ["admin-tasks"] });
    qc.invalidateQueries({ queryKey: ["clients"] });
  }

  async function decideRedemption(t: AdminTaskRedemption, status: "fulfilled" | "cancelled") {
    setBusy(t.id);
    const rpc = t.kind === "partner" ? "set_partner_redemption_status" : "set_client_redemption_status";
    const { error } = await supabase.rpc(rpc, { p_id: t.id, p_status: status });
    setBusy(null);
    if (error) return toastError(error.message || "העדכון נכשל.");
    if (status === "fulfilled") void sendRedemptionNotice(t.recipientId, t.rewardName);
    toast({
      title: status === "fulfilled" ? "אושר ✓ נשלח עדכון למקבל" : "סומן כלא אושר והמטבעות הוחזרו",
      variant: "success",
    });
    qc.invalidateQueries({ queryKey: ["admin-tasks"] });
    qc.invalidateQueries({ queryKey: [t.kind === "partner" ? "partner-detail" : "client-detail", t.recipientId] });
  }

  async function sendReply(projectId: string) {
    const content = (replies[projectId] || "").trim();
    if (!content || !profile?.id) return;
    setBusy(projectId);
    const { error } = await supabase
      .from("messages")
      .insert({ project_id: projectId, sender_id: profile.id, content });
    setBusy(null);
    if (error) return toastError("שליחת ההודעה נכשלה.");
    setReplies((r) => ({ ...r, [projectId]: "" }));
    toast({ title: "התשובה נשלחה ✓", variant: "success" });
    qc.invalidateQueries({ queryKey: ["admin-tasks"] });
    qc.invalidateQueries({ queryKey: ["messages", projectId] });
  }

  if (isLoading) {
    return <Skeleton className="h-32 w-full rounded-2xl" />;
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center gap-2">
        <CheckCircle2 className="size-5 text-primary" />
        <h2 className="font-heading text-lg font-bold text-foreground">ממתין לטיפול שלך</h2>
        {total > 0 && <Badge variant="warning">{total}</Badge>}
      </div>

      {total === 0 ? (
        <p className="text-sm text-muted-foreground">הכול מטופל, אין משימות ממתינות 🎉</p>
      ) : (
        <div className="space-y-2.5">
          {/* Access requests (someone tried to join) */}
          {accessRequests.map((r) => (
            <div
              key={r.id}
              className="rounded-xl border border-primary/30 bg-primary/[0.05] p-3.5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">
                  <UserPlus className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">
                      <span className="font-semibold">{r.fullName}</span> ביקש/ה גישה
                      {r.businessName ? <span className="text-muted-foreground"> · {r.businessName}</span> : null}
                    </p>
                    <p className="font-mono-code text-xs text-muted-foreground">{r.email}</p>
                    {r.phone && (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Phone className="size-3" /> {r.phone}
                      </p>
                    )}
                    {r.message && (
                      <p className="mt-1 rounded-lg bg-card px-3 py-2 text-sm text-muted-foreground">
                        {r.message}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" disabled={busy === r.id} onClick={() => decideAccess(r.id, true)}>
                    <UserPlus className="size-4" /> הקם לקוח
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy === r.id}
                    onClick={() => decideAccess(r.id, false)}
                  >
                    <X className="size-4" /> דחייה
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {/* New partner leads awaiting a first look */}
          {leads.map((l) => (
            <div key={l.id} className="rounded-xl border border-brand-cyan-base/30 bg-background/30 p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">
                  <Handshake className="mt-0.5 size-4 shrink-0 text-brand-cyan-base" />
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">
                      ליד חדש מ<span className="font-semibold">{l.partnerName}</span>:{" "}
                      <span className="font-semibold">{l.leadName}</span>
                      {l.projectType ? (
                        <span className="text-muted-foreground">
                          {" "}· {PROJECT_TYPE_HE[l.projectType] ?? l.projectType}
                        </span>
                      ) : null}
                    </p>
                    {(l.leadPhone || l.leadEmail) && (
                      <p className="mt-0.5 font-mono-code text-xs text-muted-foreground">
                        {[l.leadPhone, l.leadEmail].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </div>
                </div>
                <Button asChild size="sm" variant="secondary">
                  <Link to="/admin/partners">
                    טיפול בליד <ExternalLink className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}

          {/* Pending store redemptions */}
          {redemptions.map((t) => (
            <div
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-background/30 p-3.5"
            >
              <div className="flex min-w-0 items-center gap-2">
                <Gift className="size-4 shrink-0 text-primary" />
                <p className="min-w-0 text-sm text-foreground">
                  <span className="font-semibold">{t.recipientName}</span> מימש/ה{" "}
                  <span className="font-semibold">{t.rewardName}</span>
                  <span className="text-muted-foreground"> · {t.amount} מטבעות</span>
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" disabled={busy === t.id} onClick={() => decideRedemption(t, "fulfilled")}>
                  <Check className="size-4" /> אישור
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy === t.id}
                  onClick={() => decideRedemption(t, "cancelled")}
                >
                  <X className="size-4" /> לא אושר
                </Button>
              </div>
            </div>
          ))}

          {/* Chat threads awaiting a reply */}
          {messages.map((m) => (
            <div key={m.projectId} className="rounded-xl border border-border bg-background/30 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <MessagesSquare className="size-4 shrink-0 text-brand-cyan-base" />
                  <p className="min-w-0 truncate text-sm text-foreground">
                    <span className="font-semibold">{m.senderName}</span>
                    <span className="text-muted-foreground"> · {m.projectTitle}</span>
                  </p>
                </div>
                <Button asChild size="sm" variant="ghost">
                  <Link to={`/projects/${m.projectId}#sec-chat`}>
                    פתח צ'אט <ExternalLink className="size-3.5" />
                  </Link>
                </Button>
              </div>
              <p className="mt-1.5 line-clamp-2 rounded-lg bg-card px-3 py-2 text-sm text-muted-foreground">
                {m.content}
              </p>
              <div className="mt-2 flex items-end gap-2">
                <Textarea
                  rows={1}
                  maxLength={2000}
                  placeholder="תשובה מהירה…"
                  value={replies[m.projectId] || ""}
                  onChange={(e) => setReplies((r) => ({ ...r, [m.projectId]: e.target.value }))}
                  className="min-h-[40px] flex-1"
                />
                <Button
                  size="sm"
                  disabled={busy === m.projectId || !(replies[m.projectId] || "").trim()}
                  onClick={() => sendReply(m.projectId)}
                >
                  <Send className="size-4" /> שליחה
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
