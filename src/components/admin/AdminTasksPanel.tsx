import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Check, X, Gift, MessagesSquare, ExternalLink, Send, CheckCircle2, UserPlus, Phone, Handshake, MessageSquareHeart, ShieldAlert, LifeBuoy, FileSignature, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { SelectMenu } from "@/components/ui/select-menu";
import { supabase } from "@/lib/supabase";
import { feedbackStatusHe } from "@/hooks/useClientFeedback";
import { sendRedemptionNotice } from "@/lib/invite";
import { toast, toastError } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  useAdminTasks,
  type AdminTaskRedemption,
  type AdminTaskMemberInvite,
  type AdminTaskAccessRequest,
} from "@/hooks/useAdminTasks";
import { dismissAgreement } from "@/hooks/useService";
import { rejectMemberInvite } from "@/hooks/useOrg";
import { ApproveMemberInviteSheet } from "@/components/admin/ApproveMemberInviteSheet";
import { ApproveAccessRequestSheet } from "@/components/admin/ApproveAccessRequestSheet";

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
  const [fbStatus, setFbStatus] = useState<Record<string, "open" | "in_progress" | "resolved">>({});
  const [approveTarget, setApproveTarget] = useState<AdminTaskMemberInvite | null>(null);
  const [accessTarget, setAccessTarget] = useState<AdminTaskAccessRequest | null>(null);

  const redemptions = data?.redemptions ?? [];
  const messages = data?.messages ?? [];
  const accessRequests = data?.accessRequests ?? [];
  const leads = data?.leads ?? [];
  const feedback = data?.feedback ?? [];
  const loginAttempts = data?.loginAttempts ?? [];
  const serviceCalls = data?.serviceCalls ?? [];
  const agreements = data?.agreements ?? [];
  const memberInvites = data?.memberInvites ?? [];
  const total =
    redemptions.length + messages.length + accessRequests.length + leads.length +
    feedback.length + loginAttempts.length + serviceCalls.length + agreements.length +
    memberInvites.length;

  const scStatusHe: Record<string, string> = {
    new: "חדשה", scheduled: "מתוזמנת", in_progress: "בטיפול",
  };
  const tierHe: Record<string, string> = { core: "Core", pro: "Pro", ultra: "Ultra" };
  const shekel = (n: number) => "₪" + Math.round(n).toLocaleString("he-IL");

  async function dismissLoginAttempt(id: string) {
    setBusy(id);
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setBusy(null);
    if (error) return toastError("הפעולה נכשלה.");
    qc.invalidateQueries({ queryKey: ["admin-tasks"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function rejectInvite(id: string) {
    setBusy(id);
    const { error } = await rejectMemberInvite(id);
    setBusy(null);
    if (error) return toastError(error.message || "הפעולה נכשלה.");
    toast({ title: "הבקשה נדחתה", variant: "success" });
    qc.invalidateQueries({ queryKey: ["admin-tasks"] });
  }

  async function rejectAgreement(id: string) {
    if (!window.confirm("לדחות את הבקשה? היא תוסר מהרשימה והטופס יתאפשר שוב עבור הפרויקט.")) return;
    setBusy(id);
    const { error } = await dismissAgreement(id);
    setBusy(null);
    if (error) return toastError(error.message || "הפעולה נכשלה.");
    toast({ title: "הבקשה נדחתה", variant: "success" });
    qc.invalidateQueries({ queryKey: ["admin-tasks"] });
  }

  async function decideAccess(id: string) {
    setBusy(id);
    const { error } = await supabase.rpc("reject_access_request", { p_id: id });
    setBusy(null);
    if (error) return toastError(error.message || "הפעולה נכשלה.");
    toast({ title: "הבקשה נדחתה", variant: "success" });
    qc.invalidateQueries({ queryKey: ["admin-tasks"] });
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
    if (error) {
      setBusy(null);
      return toastError("שליחת ההודעה נכשלה.");
    }
    // The client's message is handled now — clear that project's admin
    // notifications so the bell + project badge stop showing it (replying from
    // the dashboard used to leave the badge on until the project was opened).
    await supabase.rpc("mark_project_notifications_read", { p_project_id: projectId });
    setBusy(null);
    setReplies((r) => ({ ...r, [projectId]: "" }));
    toast({ title: "התשובה נשלחה ✓", variant: "success" });
    qc.invalidateQueries({ queryKey: ["admin-tasks"] });
    qc.invalidateQueries({ queryKey: ["messages", projectId] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  async function sendFeedbackReply(id: string) {
    const content = (replies[id] || "").trim();
    if (!content) return;
    setBusy(id);
    const { error } = await supabase
      .from("client_feedback")
      .update({ admin_reply: content.slice(0, 2000), status: fbStatus[id] ?? "in_progress" })
      .eq("id", id);
    if (error) {
      setBusy(null);
      return toastError("שליחת התשובה נכשלה.");
    }
    // The note is handled — clear its admin notification (the notify_feedback
    // trigger already sent the reply to the client).
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("type", "feedback")
      .eq("is_read", false);
    setBusy(null);
    setReplies((r) => ({ ...r, [id]: "" }));
    toast({ title: "התשובה נשלחה ללקוח ✓", variant: "success" });
    qc.invalidateQueries({ queryKey: ["admin-tasks"] });
    qc.invalidateQueries({ queryKey: ["admin-feedback"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
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
          {/* New signed service agreements — open the package for the client */}
          {agreements.map((a) => (
            <div key={a.id} className="rounded-xl border border-primary/40 bg-primary/[0.07] p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">
                  <FileSignature className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">
                      חתם על חבילת שירות: <span className="font-semibold">{a.business || a.fullName}</span>
                      <span className="text-muted-foreground">
                        {" "}· {tierHe[a.tier] ?? a.tier}
                        {a.monthlyPrice != null ? ` · ${shekel(a.monthlyPrice)}${a.billingCycle === "annual" ? "/שנה" : "/חודש"}` : ""}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {a.projectTitle
                        ? <>לשייך לפרויקט: <span className="font-semibold text-foreground">{a.projectTitle}</span></>
                        : "לא שויך לפרויקט, לשייך ידנית"}
                      {a.phone ? <span className="font-mono-code"> · {a.phone}</span> : null}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button asChild size="sm">
                    <Link to={a.projectId ? `/projects/${a.projectId}` : "/admin/maintenance"}>
                      פתח חבילה <ExternalLink className="size-3.5" />
                    </Link>
                  </Button>
                  <Button size="sm" variant="ghost" disabled={busy === a.id} onClick={() => rejectAgreement(a.id)}>
                    <X className="size-4" /> דחה
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {/* Manager requests to add a teammate */}
          {memberInvites.map((r) => (
            <div key={r.id} className="rounded-xl border border-brand-cyan-base/30 bg-background/30 p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">
                  <Users className="mt-0.5 size-4 shrink-0 text-brand-cyan-base" />
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">
                      בקשה להוספת איש צוות מ<span className="font-semibold">{r.orgName}</span>
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-foreground">{r.fullName || r.email}</p>
                    <p className="font-mono-code text-xs text-muted-foreground">
                      {r.email}
                      {r.phone ? ` · ${r.phone}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {[
                        r.reqFinance && "כספים",
                        r.reqServiceCalls && "קריאות שירות",
                        r.reqApprove && "אישור עבודות",
                        r.reqFiles && "קבצים",
                      ]
                        .filter(Boolean)
                        .join(" · ") || "ללא הרשאות"}
                    </p>
                    {r.note && (
                      <p className="mt-1 rounded-lg bg-card px-3 py-2 text-sm text-muted-foreground">{r.note}</p>
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Button size="sm" onClick={() => setApproveTarget(r)}>
                    <Check className="size-4" /> אישור
                  </Button>
                  <Button size="sm" variant="secondary" disabled={busy === r.id} onClick={() => rejectInvite(r.id)}>
                    <X className="size-4" /> דחייה
                  </Button>
                </div>
              </div>
            </div>
          ))}

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
                  <Button size="sm" disabled={busy === r.id} onClick={() => setAccessTarget(r)}>
                    <UserPlus className="size-4" /> הקם עסק + לקוח
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy === r.id}
                    onClick={() => decideAccess(r.id)}
                  >
                    <X className="size-4" /> דחייה
                  </Button>
                </div>
              </div>
            </div>
          ))}

          {/* Open service calls (client opened a קריאת שירות) */}
          {serviceCalls.map((c) => (
            <div key={c.id} className="rounded-xl border border-primary/30 bg-primary/[0.05] p-3.5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">
                  <LifeBuoy className="mt-0.5 size-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">
                      קריאת שירות מ<span className="font-semibold">{c.clientName}</span>
                      <span className="text-muted-foreground"> · {c.projectTitle}</span>
                    </p>
                    <p className="mt-0.5 truncate text-sm font-semibold text-foreground">{c.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{scStatusHe[c.status] ?? c.status}</p>
                  </div>
                </div>
                <Button asChild size="sm" variant="secondary">
                  <Link to="/admin/service-calls">
                    טיפול <ExternalLink className="size-3.5" />
                  </Link>
                </Button>
              </div>
            </div>
          ))}

          {/* Unauthorized email login attempts */}
          {loginAttempts.map((a) => (
            <div key={a.id} className="rounded-xl border border-amber-500/30 bg-amber-500/[0.06] p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex min-w-0 items-start gap-2">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-500" />
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">ניסיון כניסה עם מייל לא מורשה</p>
                    <p className="font-mono-code text-xs text-muted-foreground" dir="ltr">{a.email}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {new Date(a.createdAt).toLocaleString("he-IL")}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy === a.id}
                  onClick={() => dismissLoginAttempt(a.id)}
                >
                  <Check className="size-4" /> סמן כטופל
                </Button>
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

          {/* New client feedback notes — quick-reply inline */}
          {feedback.map((f) => (
            <div key={f.id} className="rounded-xl border border-border bg-background/30 p-3.5">
              <div className="flex items-center gap-2">
                <MessageSquareHeart className="size-4 shrink-0 text-primary" />
                <p className="min-w-0 truncate text-sm text-foreground">
                  הערה מ<span className="font-semibold">{f.clientName}</span>
                </p>
                <Button asChild size="sm" variant="ghost" className="ms-auto">
                  <Link to="/admin/feedback">
                    פתח <ExternalLink className="size-3.5" />
                  </Link>
                </Button>
              </div>
              <p className="mt-1.5 line-clamp-2 rounded-lg bg-card px-3 py-2 text-sm text-muted-foreground">
                {f.message}
              </p>
              <div className="mt-2 flex items-end gap-2">
                <Textarea
                  rows={1}
                  maxLength={2000}
                  placeholder="תשובה מהירה ללקוח…"
                  value={replies[f.id] || ""}
                  onChange={(e) => setReplies((r) => ({ ...r, [f.id]: e.target.value }))}
                  className="min-h-[40px] flex-1"
                />
                <div className="flex flex-col gap-2">
                  <SelectMenu
                    ariaLabel="סטטוס"
                    className="h-9 text-sm"
                    value={fbStatus[f.id] ?? "in_progress"}
                    onChange={(v) =>
                      setFbStatus((s) => ({ ...s, [f.id]: v as "open" | "in_progress" | "resolved" }))
                    }
                    options={(["open", "in_progress", "resolved"] as const).map((s) => ({
                      value: s,
                      label: feedbackStatusHe[s],
                    }))}
                  />
                  <Button
                    size="sm"
                    disabled={busy === f.id || !(replies[f.id] || "").trim()}
                    onClick={() => sendFeedbackReply(f.id)}
                  >
                    <Send className="size-4" /> שליחה
                  </Button>
                </div>
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

      <ApproveMemberInviteSheet
        request={approveTarget}
        onClose={() => setApproveTarget(null)}
        onApproved={() => {
          setApproveTarget(null);
          qc.invalidateQueries({ queryKey: ["admin-tasks"] });
          qc.invalidateQueries({ queryKey: ["member-invite-requests"] });
        }}
      />

      <ApproveAccessRequestSheet
        request={accessTarget}
        onClose={() => setAccessTarget(null)}
        onApproved={() => {
          setAccessTarget(null);
          qc.invalidateQueries({ queryKey: ["admin-tasks"] });
          qc.invalidateQueries({ queryKey: ["admin-businesses"] });
          qc.invalidateQueries({ queryKey: ["clients"] });
        }}
      />
    </Card>
  );
}
