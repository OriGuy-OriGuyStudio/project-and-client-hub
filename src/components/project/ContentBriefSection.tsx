import { useMemo, useRef, useState } from "react";
import { ClipboardList, Check, Loader2, Paperclip, X } from "lucide-react";
import { SectionShell } from "@/components/project/SectionShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { uploadBriefFile, validateFile, isImage } from "@/lib/files";
import { gendered } from "@/lib/gender";
import { useAuth } from "@/hooks/useAuth";
import { useQueryClient } from "@tanstack/react-query";
import { toastError } from "@/hooks/use-toast";
import { usePublishedBrief, useBriefResponses } from "@/hooks/useDeliverables";
import type { BriefContent, BriefFileRef, BriefItem, BriefResponse, Gender } from "@/types/database";

/**
 * Client-facing content brief: the studio-defined checklist of texts + assets to
 * provide, per page. The client fills text and uploads files (which also land in
 * the project's "קבצים"), and marks items done. Hidden until a brief is published.
 */
export function ContentBriefSection({ projectId }: { projectId: string }) {
  const { profile } = useAuth();
  const qc = useQueryClient();
  const { data: briefRow } = usePublishedBrief(projectId);
  const { data: responses } = useBriefResponses(projectId);

  const content = briefRow?.content as unknown as BriefContent | undefined;
  const respByItem = useMemo(() => {
    const m = new Map<string, BriefResponse>();
    (responses ?? []).forEach((r) => m.set(r.item_id, r));
    return m;
  }, [responses]);

  if (!briefRow || !content?.pages?.length) return null;

  const total = content.pages.reduce((n, p) => n + (p.items?.length ?? 0), 0);
  const doneCount = (responses ?? []).filter((r) => r.done).length;

  async function upsert(itemId: string, patch: Partial<Pick<BriefResponse, "text" | "files" | "done">>) {
    const existing = respByItem.get(itemId);
    const row = {
      project_id: projectId,
      org_id: briefRow!.org_id,
      item_id: itemId,
      text: patch.text !== undefined ? patch.text : existing?.text ?? null,
      files: patch.files !== undefined ? patch.files : existing?.files ?? [],
      done: patch.done !== undefined ? patch.done : existing?.done ?? false,
      updated_by: profile?.id ?? null,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase
      .from("brief_responses")
      .upsert(row, { onConflict: "project_id,item_id" });
    if (error) {
      toastError("השמירה נכשלה, נסה שוב.");
      return false;
    }
    qc.invalidateQueries({ queryKey: ["brief-responses", projectId] });
    return true;
  }

  return (
    <SectionShell
      icon={ClipboardList}
      title={content.title || "החומרים לאתר"}
      actions={
        total > 0 ? (
          <Badge variant={doneCount >= total ? "success" : "secondary"}>
            {doneCount}/{total}
          </Badge>
        ) : undefined
      }
    >
      <p className="mb-4 text-sm text-muted-foreground">
        {gendered(
          profile?.gender,
          "כאן אתה ממלא ומעלה את החומרים שצריך לכל עמוד באתר. מה שתעלה נשמר אצלי אוטומטית.",
          "כאן את ממלאת ומעלה את החומרים שצריך לכל עמוד באתר. מה שתעלי נשמר אצלי אוטומטית."
        )}
      </p>
      <div className="space-y-5">
        {content.pages.map((page, pi) => (
          <div key={pi} className="space-y-2">
            <h4 className="font-heading text-sm font-semibold text-foreground">{page.name}</h4>
            <div className="space-y-2">
              {(page.items ?? []).map((item) => (
                <BriefItemRow
                  key={item.id}
                  projectId={projectId}
                  item={item}
                  resp={respByItem.get(item.id)}
                  gender={profile?.gender}
                  uploadedBy={profile?.id ?? null}
                  onSave={(patch) => upsert(item.id, patch)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </SectionShell>
  );
}

function BriefItemRow({
  projectId,
  item,
  resp,
  gender,
  uploadedBy,
  onSave,
}: {
  projectId: string;
  item: BriefItem;
  resp?: BriefResponse;
  gender?: Gender | null;
  uploadedBy: string | null;
  onSave: (patch: Partial<Pick<BriefResponse, "text" | "files" | "done">>) => Promise<boolean>;
}) {
  // Seed text items from the discovery-prefilled value so the client just confirms/fixes.
  const [text, setText] = useState(resp?.text ?? item.prefill ?? "");
  const [uploading, setUploading] = useState(false);
  const usingPrefill = !resp?.text && !!item.prefill;
  const fileRef = useRef<HTMLInputElement>(null);
  const files = resp?.files ?? [];
  const done = resp?.done ?? false;
  const isText = item.kind === "text";
  const multiple = item.kind === "gallery";
  const accept = item.kind === "image" || item.kind === "gallery" ? "image/*" : undefined;

  async function onPick(list: FileList | null) {
    if (!list || list.length === 0) return;
    setUploading(true);
    try {
      const added: BriefFileRef[] = [];
      for (const file of Array.from(list)) {
        const err = validateFile(file);
        if (err) {
          toastError(err);
          continue;
        }
        added.push(await uploadBriefFile({ projectId, file, uploadedBy }));
      }
      if (added.length) await onSave({ files: [...files, ...added] });
    } catch {
      toastError("ההעלאה נכשלה, נסה שוב.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function removeFile(path: string) {
    await onSave({ files: files.filter((f) => f.path !== path) });
  }

  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {item.label}
            {item.required && <span className="text-primary"> *</span>}
          </p>
          {item.help && <p className="text-xs text-muted-foreground">{item.help}</p>}
          {isText && usingPrefill && (
            <p className="text-xs text-primary/80">מולא מראש מהשיחה, אשרו או תקנו.</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onSave({ done: !done, text })}
          className={cnDone(done)}
          aria-pressed={done}
        >
          <Check className="size-3.5" />
          {done ? "הושלם" : gendered(gender, "סמן כהושלם", "סמני כהושלם")}
        </button>
      </div>

      {isText ? (
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            if ((resp?.text ?? "") !== text) onSave({ text });
          }}
          placeholder={gendered(gender, "כתוב כאן…", "כתבי כאן…")}
          rows={3}
          className="mt-2"
        />
      ) : (
        <div className="mt-2 space-y-2">
          {files.map((f) => (
            <div
              key={f.path}
              className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-2 py-1.5 text-sm"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <Paperclip className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="truncate">{f.name}</span>
                {isImage(f.mime) && <Badge variant="outline">תמונה</Badge>}
              </span>
              <button
                type="button"
                onClick={() => removeFile(f.path)}
                className="text-muted-foreground hover:text-destructive"
                aria-label="הסר"
              >
                <X className="size-4" />
              </button>
            </div>
          ))}
          <input
            ref={fileRef}
            type="file"
            accept={accept}
            multiple={multiple}
            className="hidden"
            onChange={(e) => onPick(e.target.files)}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
            {multiple
              ? gendered(gender, "העלה תמונות", "העלי תמונות")
              : gendered(gender, "העלה קובץ", "העלי קובץ")}
          </Button>
        </div>
      )}
    </div>
  );
}

function cnDone(done: boolean) {
  return [
    "flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors",
    done
      ? "border-primary bg-primary/15 text-primary"
      : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
  ].join(" ");
}
