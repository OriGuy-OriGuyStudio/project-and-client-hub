import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bug,
  ImagePlus,
  ListPlus,
  Loader2,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { supabase, PROJECT_FILES_BUCKET } from "@/lib/supabase";
import { getSignedUrl } from "@/lib/files";
import { toast, toastError } from "@/hooks/use-toast";
import { useMyCapabilities } from "@/hooks/useMyCapabilities";
import { clampText } from "@/lib/sanitize";
import { cn } from "@/lib/utils";
import { useDevFeedback } from "@/hooks/useDevFeedback";
import type { DevFeedback } from "@/types/database";

const STATUS_HE: Record<DevFeedback["status"], string> = {
  received: "התקבלה",
  in_progress: "בטיפול",
  done: "טופל",
};
const STATUS_VARIANT: Record<DevFeedback["status"], "secondary" | "warning" | "success"> = {
  received: "secondary",
  in_progress: "warning",
  done: "success",
};

export function DevFeedbackSection({
  projectId,
  isAdmin,
  actorId,
}: {
  projectId: string;
  isAdmin: boolean;
  actorId: string | null;
}) {
  const qc = useQueryClient();
  // Posting a dev-feedback note requires the files capability (a viewer is read-only).
  const { files: canFiles } = useMyCapabilities(isAdmin ? null : projectId);
  const canWrite = isAdmin || canFiles;
  const { data: items, isLoading } = useDevFeedback(projectId);
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState("");
  const [body, setBody] = useState("");
  const [urgent, setUrgent] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = () => qc.invalidateQueries({ queryKey: ["dev-feedback", projectId] });

  function reset() {
    setPage("");
    setBody("");
    setUrgent(false);
    setFile(null);
    setOpen(false);
  }

  async function submit() {
    const text = clampText(body.trim(), 4000);
    if (!text) return toastError("כתוב את ההערה.");
    setBusy(true);
    try {
      let screenshot_path: string | null = null;
      if (file) {
        if (!file.type.startsWith("image/")) throw new Error("only_image");
        const safe = file.name.replace(/[^\w.\-]+/g, "_");
        const path = `${projectId}/feedback/${crypto.randomUUID()}-${safe}`;
        const { error: upErr } = await supabase.storage
          .from(PROJECT_FILES_BUCKET)
          .upload(path, file, { contentType: file.type, upsert: false });
        if (upErr) throw upErr;
        screenshot_path = path;
      }
      const { error } = await supabase.from("dev_feedback").insert({
        project_id: projectId,
        author_id: actorId,
        page: clampText(page.trim(), 160) || null,
        body: text,
        screenshot_path,
        priority: urgent ? "urgent" : "normal",
      });
      if (error) throw error;
      toast({ title: "ההערה נשלחה ✓", variant: "success" });
      reset();
      refresh();
    } catch (e) {
      toastError(
        e instanceof Error && e.message === "only_image"
          ? "אפשר לצרף רק תמונה (צילום מסך)."
          : "שליחת ההערה נכשלה."
      );
    } finally {
      setBusy(false);
    }
  }

  async function promote(item: DevFeedback) {
    setBusy(true);
    const { error } = await supabase.rpc("promote_dev_feedback", { p_id: item.id });
    setBusy(false);
    if (error) return toastError("ההוספה לסבב התיקונים נכשלה.");
    toast({ title: "נוספה לסבב התיקונים ✓", variant: "success" });
    refresh();
  }

  async function remove(item: DevFeedback) {
    const { error } = await supabase.from("dev_feedback").delete().eq("id", item.id);
    if (error) return toastError("המחיקה נכשלה.");
    refresh();
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Bug className="size-5 text-brand-cyan-base" />
          <h2 className="font-heading text-lg font-semibold text-foreground">הערות פיתוח</h2>
        </div>
        {canWrite && (
          <Button size="sm" variant="ghost" onClick={() => setOpen((v) => !v)}>
            <Plus className="size-4" /> הערה
          </Button>
        )}
      </div>

      {!isAdmin && canWrite && (
        <p className="mb-3 text-xs text-muted-foreground">
          ראית משהו באתר שצריך תיקון או שיפור? כתוב לי כאן, אפשר לצרף צילום מסך, ואני אטפל בזה.
        </p>
      )}

      {open && canWrite && (
        <div className="mb-4 space-y-2 rounded-xl border border-border bg-background/30 p-3">
          <Input
            placeholder="עמוד / אזור (לדוגמה: עמוד הבית, טופס יצירת קשר)"
            maxLength={160}
            value={page}
            onChange={(e) => setPage(e.target.value)}
          />
          <Textarea
            placeholder="מה צריך לתקן או לשפר?"
            rows={3}
            maxLength={4000}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setUrgent((v) => !v)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                urgent
                  ? "border-destructive/50 bg-destructive/10 text-destructive"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {urgent ? "דחוף ✓" : "סימון כדחוף"}
            </button>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
              <ImagePlus className="size-3.5" />
              {file ? "תמונה צורפה" : "צירוף צילום מסך"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </label>
            {file && (
              <button
                type="button"
                onClick={() => setFile(null)}
                className="text-muted-foreground hover:text-destructive"
                aria-label="הסרת התמונה"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={reset}>
              ביטול
            </Button>
            <Button size="sm" onClick={submit} disabled={busy}>
              {busy ? "שולח…" : "שליחת הערה"}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-20 w-full rounded-xl" />
      ) : !items?.length ? (
        <EmptyState icon={Bug} title="אין עדיין הערות פיתוח" />
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <FeedbackRow
              key={item.id}
              item={item}
              isAdmin={isAdmin}
              busy={busy}
              onPromote={() => promote(item)}
              onDelete={() => remove(item)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}

function FeedbackRow({
  item,
  isAdmin,
  busy,
  onPromote,
  onDelete,
}: {
  item: DevFeedback;
  isAdmin: boolean;
  busy: boolean;
  onPromote: () => void;
  onDelete: () => void;
}) {
  const [shot, setShot] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (item.screenshot_path) {
      getSignedUrl(item.screenshot_path).then((u) => alive && setShot(u));
    }
    return () => {
      alive = false;
    };
  }, [item.screenshot_path]);

  const canDelete = isAdmin || item.status === "received";

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border bg-background/30 p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
      <div className="flex min-w-0 flex-1 gap-3">
        {shot && (
          <a href={shot} target="_blank" rel="noreferrer noopener" className="shrink-0">
            <img
              src={shot}
              alt="צילום מסך"
              className="size-12 rounded-lg border border-border object-cover"
            />
          </a>
        )}
        <div className="min-w-0">
          {item.page && (
            <p className="text-xs font-medium text-brand-cyan-base [overflow-wrap:anywhere]">
              {item.page}
            </p>
          )}
          <p className="text-sm text-foreground [overflow-wrap:anywhere]">{item.body}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {new Date(item.created_at).toLocaleDateString("he-IL")}
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {item.priority === "urgent" && <Badge variant="destructive">דחוף</Badge>}
        <Badge variant={STATUS_VARIANT[item.status]}>{STATUS_HE[item.status]}</Badge>
        {isAdmin && item.status === "received" && (
          <Button size="sm" variant="secondary" onClick={onPromote} disabled={busy}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : <ListPlus className="size-4" />}
            לסבב תיקונים
          </Button>
        )}
        {canDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-destructive"
            aria-label="מחיקה"
            onClick={onDelete}
          >
            <Trash2 className="size-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
