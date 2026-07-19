// Admin , "יומן מיילים": every email the system sent, newest first, with the
// exact body, the recipient, the time, and whether Gmail accepted it. Rows are
// written by the Edge Function mailers into `email_log` (service role) on both
// the success and failure paths, so a bounce-at-send shows up here instead of
// disappearing. Read-only apart from deleting a row.

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, ChevronDown, Loader2, Mail, RefreshCw, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { SelectMenu } from "@/components/ui/select-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { toastError } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useEmailLog, useDeleteEmailLogRow, type EmailLogRow } from "@/hooks/useEmailLog";

/** Hebrew label per mailer (the `kind` column is the function's directory
 *  name). An unknown kind falls back to the raw value so a new mailer still
 *  shows up correctly before this map is updated. */
const KIND_HE: Record<string, string> = {
  "notify-lead": "ליד חדש (לסטודיו)",
  "notify-lead-status": "עדכון סטטוס ליד (למפנה)",
  "notify-admin-task": "משימת אדמין",
  "notify-agreement": "הסכם שירות",
  "notify-service-status": "עדכון קריאת שירות",
  "notify-service-welcome": "ברוכים הבאים לשירות",
  "send-gift-notice": "הודעת מתנה",
  "send-invite": "הזמנה לפורטל",
  "send-redemption-notice": "מימוש פרס",
  "send-report": "דוח",
  "send-test-email": "מייל בדיקה",
  "warranty-reminder": "תזכורת אחריות",
};

function kindLabel(kind: string) {
  return KIND_HE[kind] ?? kind;
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EmailLog() {
  const { data: rows, isLoading, refetch, isFetching } = useEmailLog();
  const [kind, setKind] = useState("");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");

  const kindOptions = useMemo(() => {
    const kinds = Array.from(new Set((rows ?? []).map((r) => r.kind))).sort();
    return [{ value: "", label: "כל הסוגים" }, ...kinds.map((k) => ({ value: k, label: kindLabel(k) }))];
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (rows ?? []).filter((r) => {
      if (kind && r.kind !== kind) return false;
      if (status === "ok" && !r.ok) return false;
      if (status === "failed" && r.ok) return false;
      if (needle && !`${r.to_email} ${r.subject}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rows, kind, status, q]);

  const failedCount = (rows ?? []).filter((r) => !r.ok).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="icon" className="size-8">
          <Link to="/admin/tools" aria-label="חזרה">
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        <PageHeader
          title="יומן מיילים"
          subtitle="כל מייל שהמערכת שלחה: למי, מתי, אם השליחה הצליחה, ומה היה התוכן המדויק."
        />
      </div>

      <Card className="space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <SelectMenu variant="field" ariaLabel="סוג מייל" value={kind} onChange={setKind} options={kindOptions} />
          <SelectMenu
            variant="field"
            ariaLabel="סטטוס שליחה"
            value={status}
            onChange={setStatus}
            options={[
              { value: "", label: "הכל" },
              { value: "ok", label: "נשלח בהצלחה" },
              { value: "failed", label: "נכשל" },
            ]}
          />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="חיפוש לפי נמען או נושא…" />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {isLoading ? "טוען…" : `מוצגים ${filtered.length} מתוך ${rows?.length ?? 0} מיילים אחרונים.`}
            {failedCount > 0 && <span className="text-destructive"> {failedCount} נכשלו.</span>}
          </p>
          <Button variant="secondary" size="sm" onClick={() => void refetch()} disabled={isFetching}>
            {isFetching ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            רענון
          </Button>
        </div>
      </Card>

      {!isLoading && filtered.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="אין מיילים להצגה"
          description={
            (rows?.length ?? 0) === 0
              ? "עדיין לא נשלחו מיילים, או שהיומן נוקה."
              : "אין מיילים שתואמים לסינון הנוכחי."
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((row) => (
            <EmailRow key={row.id} row={row} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmailRow({ row }: { row: EmailLogRow }) {
  const [open, setOpen] = useState(false);
  const del = useDeleteEmailLogRow();

  return (
    <Card className="overflow-hidden p-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full flex-wrap items-center gap-3 p-4 text-start transition-colors hover:bg-field"
      >
        <Badge variant={row.ok ? "success" : "destructive"}>{row.ok ? "נשלח" : "נכשל"}</Badge>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{row.subject}</p>
          <p className="truncate text-xs text-muted-foreground">
            {kindLabel(row.kind)} · אל {row.to_email}
          </p>
        </div>
        <span className="shrink-0 text-xs text-muted-foreground">{formatWhen(row.created_at)}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="space-y-3 border-t border-border p-4">
          {!row.ok && row.error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3">
              <p className="text-xs font-semibold text-destructive">שגיאת שליחה</p>
              <p className="mt-1 break-all text-xs text-muted-foreground">{row.error}</p>
            </div>
          )}

          {Object.keys(row.context ?? {}).length > 0 && (
            <div className="rounded-lg border border-border bg-field p-3">
              <p className="text-xs font-semibold text-foreground">הקשר</p>
              <pre dir="ltr" className="mt-1 overflow-x-auto whitespace-pre-wrap break-all text-xs text-muted-foreground">
                {JSON.stringify(row.context, null, 2)}
              </pre>
            </div>
          )}

          <div>
            <p className="mb-1.5 text-xs font-semibold text-foreground">תוכן המייל כפי שנשלח</p>
            {row.html ? (
              // The stored body is our own mailer HTML (never user-authored),
              // and it's rendered inside a sandboxed iframe with scripts off,
              // so nothing in it can touch the admin page.
              <iframe
                title={`תוכן המייל: ${row.subject}`}
                srcDoc={row.html}
                sandbox=""
                className="h-[420px] w-full rounded-xl border border-border bg-white"
              />
            ) : (
              <p className="text-xs text-muted-foreground">לא נשמר תוכן למייל הזה.</p>
            )}
          </div>

          <div className="flex justify-end border-t border-border pt-3">
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive"
              disabled={del.isPending}
              onClick={() => {
                if (!window.confirm("למחוק את הרשומה מהיומן? המייל עצמו כבר נשלח וזה לא מבטל אותו.")) return;
                del.mutate(row.id, { onError: () => toastError("המחיקה נכשלה.") });
              }}
            >
              <Trash2 className="size-4" /> מחיקה מהיומן
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
