import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  ExternalLink,
  Eye,
  EyeOff,
  ListChecks,
  Loader2,
  Save,
  Sparkles,
  Trash2,
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
import { supabase } from "@/lib/supabase";
import { toast, toastError } from "@/hooks/use-toast";
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
  const [aiBusy, setAiBusy] = useState<null | "client" | "follow_up">(null);
  const [draft, setDraft] = useState({
    answers: {} as Record<string, DiscoveryAnswer>,
    client_summary: "",
    follow_up: "",
    status: "draft" as "draft" | "done",
  });

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
      status: session.status,
    });
    setSeeded(true);
  }

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
        status: draft.status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", session!.id);
    setSaving(false);
    if (error) return toastError("השמירה נכשלה.");
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
          <Button asChild variant="secondary" size="sm">
            <a href={shareUrl} target="_blank" rel="noreferrer noopener">
              צפה בסיכום <ExternalLink className="size-3.5" />
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
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ListChecks className="size-4 text-brand-cyan-base" />
          {shownCount} תשובות מסומנות לתצוגה ללקוח
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
            placeholder="משימות, סיכונים, דברים לבדוק, הצעת מחיר…"
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
    </div>
  );
}
