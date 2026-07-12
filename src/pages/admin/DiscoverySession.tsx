import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  ListChecks,
  Loader2,
  Save,
  Sparkles,
  StickyNote,
  Trash2,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { SelectMenu } from "@/components/ui/select-menu";
import { CopyButton } from "@/components/ui/copy-button";
import { CenteredLoader } from "@/components/ui/brand-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/sheet";
import { supabase } from "@/lib/supabase";
import { toast, toastError } from "@/hooks/use-toast";
import { useProjects } from "@/hooks/useProjects";
import { useBusinesses } from "@/hooks/useBusinesses";
import { useAdminOrgMembers } from "@/hooks/useOrg";
import { summarizeDiscovery } from "@/lib/invite";
import { clampText } from "@/lib/sanitize";
import { cn } from "@/lib/utils";
import { templateByKey } from "@/lib/discovery";
import type { DiscoveryAnswer, DiscoverySession } from "@/types/database";

export default function DiscoverySessionPage() {
  const { id } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [fullOpen, setFullOpen] = useState(false);
  const [aiBusy, setAiBusy] = useState<null | "client" | "follow_up">(null);
  const [notesOpen, setNotesOpen] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const notesTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedNotes = useRef<string>("");
  const { data: projects } = useProjects();
  const { data: businesses } = useBusinesses();
  const [draft, setDraft] = useState({
    answers: {} as Record<string, DiscoveryAnswer>,
    client_summary: "",
    follow_up: "",
    admin_notes: "",
    status: "draft" as "draft" | "done",
    client_id: "",
    org_id: "",
    attendee_ids: [] as string[],
    project_id: "",
  });
  const { data: orgMembers } = useAdminOrgMembers(draft.org_id || null);

  const { data: session, isLoading, isError } = useQuery({
    queryKey: ["discovery-session", id],
    enabled: !!id,
    queryFn: async (): Promise<DiscoverySession | null> => {
      const { data, error } = await supabase
        .from("discovery_sessions")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (session && !seeded) {
    setDraft({
      answers: session.answers ?? {},
      client_summary: session.client_summary ?? "",
      follow_up: session.follow_up ?? "",
      admin_notes: session.admin_notes ?? "",
      status: session.status,
      client_id: session.client_id ?? "",
      org_id: session.org_id ?? "",
      attendee_ids: session.attendee_ids ?? [],
      project_id: session.project_id ?? "",
    });
    lastSavedNotes.current = session.admin_notes ?? "";
    setSeeded(true);
  }

  // Sticky notepad autosaves on its own (debounced) so call notes are never lost.
  useEffect(() => {
    if (!seeded || !id) return;
    if (draft.admin_notes === lastSavedNotes.current) return;
    setNotesSaving(true);
    if (notesTimer.current) clearTimeout(notesTimer.current);
    notesTimer.current = setTimeout(async () => {
      const value = clampText(draft.admin_notes.trim(), 8000);
      const { error } = await supabase
        .from("discovery_sessions")
        .update({ admin_notes: value || null })
        .eq("id", id);
      if (!error) lastSavedNotes.current = draft.admin_notes;
      setNotesSaving(false);
    }, 800);
    return () => {
      if (notesTimer.current) clearTimeout(notesTimer.current);
    };
  }, [draft.admin_notes, seeded, id]);

  if (isLoading) return <CenteredLoader label="טוען שיחה…" />;
  if (isError || !session) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="השיחה לא נמצאה"
        description="ייתכן שהיא נמחקה."
        action={
          <Button asChild variant="secondary">
            <Link to="/admin/discovery">חזרה לשיחות</Link>
          </Button>
        }
      />
    );
  }

  const template = templateByKey(session.template_key);
  const shareUrl = `${window.location.origin}/discovery/${session.share_token}`;

  const setAnswer = (qid: string, patch: Partial<DiscoveryAnswer>) =>
    setDraft((d) => {
      const prev = d.answers[qid] ?? { value: "", show: false };
      return { ...d, answers: { ...d.answers, [qid]: { ...prev, ...patch } } };
    });

  function appendChip(qid: string, chip: string) {
    const cur = (draft.answers[qid]?.value ?? "").trim();
    if (cur.includes(chip)) return; // already added
    setAnswer(qid, { value: cur ? `${cur}, ${chip}` : chip });
  }

  const toggleAttendee = (uid: string) =>
    setDraft((d) => ({
      ...d,
      attendee_ids: d.attendee_ids.includes(uid)
        ? d.attendee_ids.filter((x) => x !== uid)
        : [...d.attendee_ids, uid],
    }));

  function buildItems() {
    const out: { question: string; answer: string; show: boolean }[] = [];
    for (const sec of template.sections) {
      for (const q of sec.questions) {
        const a = draft.answers[q.id];
        if (a?.value?.trim()) out.push({ question: q.q, answer: a.value, show: !!a.show });
      }
    }
    return out;
  }

  async function runAi(kind: "client" | "follow_up") {
    const items = buildItems();
    if (!items.length) return toastError("מלא תשובות לפני יצירת סיכום AI.");
    setAiBusy(kind);
    const r = await summarizeDiscovery({ kind, title: session!.title, items });
    setAiBusy(null);
    if (!r.ok || !r.text) return toastError(r.error || "סיכום ה-AI נכשל.");
    setDraft((d) =>
      kind === "client" ? { ...d, client_summary: r.text! } : { ...d, follow_up: r.text! }
    );
    toast({ title: "סיכום AI נוצר. אפשר לערוך ולשמור.", variant: "success" });
  }

  async function save() {
    setSaving(true);
    // Trim empty answers down so the jsonb stays tidy.
    const answers: Record<string, DiscoveryAnswer> = {};
    for (const [k, v] of Object.entries(draft.answers)) {
      const value = clampText((v.value ?? "").trim(), 4000);
      if (value || v.show) answers[k] = { value, show: !!v.show };
    }
    const { error } = await supabase
      .from("discovery_sessions")
      .update({
        answers,
        client_summary: clampText(draft.client_summary.trim(), 6000) || null,
        follow_up: clampText(draft.follow_up.trim(), 6000) || null,
        admin_notes: clampText(draft.admin_notes.trim(), 8000) || null,
        status: draft.status,
        client_id: draft.client_id || null,
        org_id: draft.org_id || null,
        attendee_ids: draft.org_id ? draft.attendee_ids : [],
        project_id: draft.org_id ? draft.project_id || null : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session!.id);
    setSaving(false);
    if (error) return toastError("השמירה נכשלה.");
    lastSavedNotes.current = draft.admin_notes;
    toast({ title: "נשמר", variant: "success" });
    qc.invalidateQueries({ queryKey: ["discovery-session", id] });
    qc.invalidateQueries({ queryKey: ["discovery-sessions"] });
  }

  async function remove() {
    const { error } = await supabase.from("discovery_sessions").delete().eq("id", session!.id);
    if (error) return toastError("המחיקה נכשלה.");
    qc.invalidateQueries({ queryKey: ["discovery-sessions"] });
    navigate("/admin/discovery");
  }

  const shownCount = Object.values(draft.answers).filter((a) => a.show && a.value).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Button asChild variant="ghost" size="icon" className="size-8">
            <Link to="/admin/discovery" aria-label="חזרה">
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <div className="min-w-0">
            <h1 className="truncate font-heading text-xl font-bold text-foreground">
              {session.title}
            </h1>
            <p className="text-xs text-muted-foreground">{template.label}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="secondary" size="sm" onClick={() => setFullOpen(true)}>
            <FileText className="size-3.5" /> סיכום מלא
          </Button>
          <Button asChild variant="secondary" size="sm">
            <a href={shareUrl} target="_blank" rel="noreferrer noopener">
              תצוגת לקוח <ExternalLink className="size-3.5" />
            </a>
          </Button>
          <CopyButton
            content={shareUrl}
            variant="ghost"
            size="sm"
            label="העתק קישור"
            toastMessage="קישור הסיכום הועתק"
          />
          <Button size="sm" onClick={save} disabled={saving}>
            <Save className="size-4" /> {saving ? "שומר…" : "שמירה"}
          </Button>
        </div>
      </div>

      {/* Status + share hint */}
      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ListChecks className="size-4 text-brand-cyan-base" />
            {shownCount} תשובות מסומנות לתצוגה ללקוח
          </div>
          <p className="text-xs text-muted-foreground/80">
            הדף הזה הוא התצוגה המלאה שלך (כולל פנימי). הלקוח רואה רק תשובות שסימנת "ללקוח" ואת
            "הסיכום ללקוח". לחיצה על "תצוגת לקוח" פותחת בדיוק את מה שהלקוח רואה.
          </p>
        </div>
        <div className="w-40">
          <SelectMenu
            ariaLabel="סטטוס"
            variant="field"
            value={draft.status}
            onChange={(v) => setDraft((d) => ({ ...d, status: v as "draft" | "done" }))}
            options={[
              { value: "draft", label: "טיוטה" },
              { value: "done", label: "הושלם" },
            ]}
          />
        </div>
      </Card>

      {/* Business → attendees → project assignment (org-centric) */}
      <Card className="space-y-3 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="d-org">שיוך לעסק</Label>
          <SelectMenu
            id="d-org"
            variant="field"
            ariaLabel="עסק"
            value={draft.org_id}
            onChange={(v) =>
              setDraft((d) => ({ ...d, org_id: v, attendee_ids: [], project_id: "" }))
            }
            options={[
              { value: "", label: "ללא עסק (ליד)" },
              ...(businesses ?? []).map((b) => ({ value: b.id, label: b.name })),
            ]}
          />
        </div>

        {draft.org_id && (
          <div className="space-y-1.5">
            <Label>מי היה בשיחה</Label>
            {orgMembers && orgMembers.filter((m) => m.user_id).length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {orgMembers
                  .filter((m) => m.user_id)
                  .map((m) => {
                    const on = draft.attendee_ids.includes(m.user_id!);
                    return (
                      <button
                        key={m.user_id}
                        type="button"
                        onClick={() => toggleAttendee(m.user_id!)}
                        className={cn(
                          "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                          on
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {m.full_name}
                      </button>
                    );
                  })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                לעסק הזה עדיין אין אנשי קשר להצגה.
              </p>
            )}
          </div>
        )}

        {draft.org_id && (
          <div className="space-y-1.5">
            <Label htmlFor="d-project">שיוך לפרויקט</Label>
            <SelectMenu
              id="d-project"
              variant="field"
              ariaLabel="פרויקט"
              value={draft.project_id}
              onChange={(v) => setDraft((d) => ({ ...d, project_id: v }))}
              options={[
                { value: "", label: "ללא פרויקט" },
                ...(projects ?? [])
                  .filter((p) => p.org_id === draft.org_id)
                  .map((p) => ({ value: p.id, label: p.title })),
              ]}
            />
          </div>
        )}

        <p className="text-xs text-muted-foreground/80">
          {draft.org_id
            ? draft.status === "done"
              ? "השיחה משויכת לעסק ומסומנת 'הושלם', אז הסיכום מופיע בפורטל אצל כל חברי העסק (תחת 'סיכומי שיחות אפיון')."
              : "השיחה משויכת לעסק, אבל הסיכום יופיע בפורטל אצל חברי העסק רק כשתסמן את הסטטוס 'הושלם'."
            : "שיחה ללא עסק (ליד). אפשר לשייך עסק בהמשך, ואז הסיכום יופיע בפורטל אצל חבריו. אל תשכח לשמור."}
        </p>
      </Card>

      {/* Questionnaire */}
      {template.sections.map((sec) => (
        <Card key={sec.key} className="space-y-4 p-5">
          <h2 className="font-heading text-lg font-semibold text-foreground">{sec.title}</h2>
          {sec.questions.map((q) => {
            const a = draft.answers[q.id] ?? { value: "", show: false };
            return (
              <div key={q.id} className="space-y-1.5">
                <div className="flex items-start justify-between gap-3">
                  <Label htmlFor={q.id} className="leading-relaxed">
                    {q.q}
                    {q.hint && (
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        {q.hint}
                      </span>
                    )}
                  </Label>
                  <button
                    type="button"
                    onClick={() => setAnswer(q.id, { show: !a.show })}
                    title={a.show ? "מוצג ללקוח (לחץ להסתיר)" : "מוסתר מהלקוח (לחץ להציג)"}
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
                      a.show
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {a.show ? <Eye className="size-3" /> : <EyeOff className="size-3" />}
                    {a.show ? "ללקוח" : "פנימי"}
                  </button>
                </div>
                <Textarea
                  id={q.id}
                  rows={2}
                  value={a.value}
                  maxLength={4000}
                  onChange={(e) => setAnswer(q.id, { value: e.target.value })}
                  placeholder="התשובה מהשיחה…"
                />
                {q.chips && q.chips.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {q.chips.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => appendChip(q.id, c)}
                        className="rounded-full border border-border bg-background/40 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </Card>
      ))}

      {/* Summary + follow-up */}
      <Card className="space-y-4 p-5">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="client-summary">סיכום ללקוח</Label>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => runAi("client")}
              disabled={aiBusy !== null}
            >
              {aiBusy === "client" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              סכם עם AI
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            הטקסט הזה מופיע בראש עמוד הסיכום שמשותף ללקוח. ה-AI מסכם מהתשובות
            שסומנו "ללקוח".
          </p>
          <Textarea
            id="client-summary"
            rows={5}
            value={draft.client_summary}
            maxLength={6000}
            onChange={(e) => setDraft((d) => ({ ...d, client_summary: e.target.value }))}
            placeholder="סיכום קצר ומסודר של מה שסוכם, מתאים לעיני הלקוח…"
          />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="follow-up">נקודות להמשך (פנימי)</Label>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => runAi("follow_up")}
              disabled={aiBusy !== null}
            >
              {aiBusy === "follow_up" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Sparkles className="size-4" />
              )}
              סכם עם AI
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            לא מוצג ללקוח. רק לעיניך. ה-AI מסכם נקודות פעולה מכל התשובות.
          </p>
          <Textarea
            id="follow-up"
            rows={4}
            value={draft.follow_up}
            maxLength={6000}
            onChange={(e) => setDraft((d) => ({ ...d, follow_up: e.target.value }))}
            placeholder="משימות, סיכונים, דברים לבדוק, נקודות להכין…"
          />
        </div>
      </Card>

      <div className="flex justify-end">
        <Button variant="ghost" className="text-destructive" onClick={() => setConfirmDel(true)}>
          <Trash2 className="size-4" /> מחיקת השיחה
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDel}
        onOpenChange={setConfirmDel}
        title="מחיקת שיחת אפיון"
        description={`למחוק את "${session.title}"? פעולה זו אינה הפיכה.`}
        onConfirm={remove}
      />

      {/* Admin full summary — everything in one readable place (read-only) */}
      <Dialog open={fullOpen} onOpenChange={setFullOpen}>
        <DialogContent className="w-full sm:max-w-2xl lg:max-w-3xl">
          <DialogHeader>
            <DialogTitle>סיכום מלא — {session.title}</DialogTitle>
            <DialogDescription>
              התצוגה המלאה שלך: הסיכום ללקוח, כל התשובות (כולל פנימי), והנקודות להמשך.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            {draft.client_summary.trim() && (
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                <h3 className="mb-1.5 font-heading text-sm font-semibold text-primary">
                  הסיכום ללקוח
                </h3>
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                  {draft.client_summary}
                </p>
              </div>
            )}

            {template.sections.map((sec) => {
              const items = sec.questions.filter((q) => draft.answers[q.id]?.value?.trim());
              if (!items.length) return null;
              return (
                <div key={sec.key} className="space-y-2">
                  <h3 className="font-heading text-sm font-semibold text-foreground">{sec.title}</h3>
                  {items.map((q) => {
                    const a = draft.answers[q.id]!;
                    return (
                      <div key={q.id} className="rounded-lg border border-border bg-card p-3">
                        <div className="mb-1 flex items-start justify-between gap-2">
                          <p className="text-xs font-semibold text-muted-foreground">{q.q}</p>
                          <span
                            className={cn(
                              "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                              a.show
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {a.show ? "ללקוח" : "פנימי"}
                          </span>
                        </div>
                        <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                          {a.value}
                        </p>
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {draft.follow_up.trim() && (
              <div className="rounded-xl border border-border bg-muted/40 p-4">
                <h3 className="mb-1.5 font-heading text-sm font-semibold text-foreground">
                  נקודות להמשך (פנימי)
                </h3>
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                  {draft.follow_up}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Sticky notepad — portal to <body> so a transformed ancestor (page
          transitions) can't break position:fixed; stays pinned everywhere. */}
      {createPortal(
        notesOpen ? (
        <div className="fixed bottom-4 start-4 z-40 flex w-[min(20rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card/95 shadow-lift backdrop-blur">
          <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
            <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
              <StickyNote className="size-4 text-brand-cyan-base" /> פתק כללי
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground">
                {notesSaving ? "שומר…" : "נשמר ✓"}
              </span>
              <button
                type="button"
                onClick={() => setNotesOpen(false)}
                aria-label="כיווץ הפתק"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>
          <Textarea
            rows={7}
            value={draft.admin_notes}
            maxLength={8000}
            onChange={(e) => setDraft((d) => ({ ...d, admin_notes: e.target.value }))}
            placeholder="הערות כלליות מהשיחה… נשמר אוטומטית, פנימי בלבד"
            className="resize-none rounded-none border-0 bg-transparent focus-visible:ring-0"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setNotesOpen(true)}
          className="fixed bottom-4 start-4 z-40 inline-flex items-center gap-1.5 rounded-full border border-border bg-card/95 px-3.5 py-2 text-sm font-medium text-foreground shadow-lift backdrop-blur transition-colors hover:border-primary/50"
        >
          <StickyNote className="size-4 text-brand-cyan-base" />
          פתק כללי
          {draft.admin_notes.trim() && (
            <span className="size-2 rounded-full bg-primary" aria-hidden />
          )}
        </button>
        ),
        document.body
      )}
    </div>
  );
}
