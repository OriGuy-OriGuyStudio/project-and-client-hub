import { useState } from "react";
import { StickyNote, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { saveSessionNote } from "@/hooks/useTimeData";

/**
 * Per-session note. The trigger shows a filled sticky-note icon when a note
 * exists (click → central popup with the note) or a faint "+" to add one.
 * Editing happens inside the same centered popup.
 */
export function SessionNote({
  sessionId,
  note,
  title,
}: {
  sessionId: string;
  note: string | null;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note ?? "");
  const [saving, setSaving] = useState(false);
  const has = !!note?.trim();

  function openDialog() {
    setDraft(note ?? "");
    setEditing(!has); // no note yet → straight into writing
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    const ok = await saveSessionNote(sessionId, draft);
    setSaving(false);
    if (ok) {
      if (draft.trim()) setEditing(false);
      else setOpen(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={has ? "צפייה בהערה" : "הוספת הערה"}
        title={has ? "יש הערה" : "הוסף הערה"}
        onClick={openDialog}
        className={cn(
          "grid size-6 shrink-0 place-items-center rounded-md border transition-colors",
          has
            ? "border-primary/40 bg-primary/10 text-primary"
            : "border-border text-muted-foreground opacity-50 hover:opacity-100",
        )}
      >
        {has ? <StickyNote className="size-3.5" /> : <Plus className="size-3.5" />}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="size-4 text-primary" /> הערה{title ? ` · ${title}` : ""}
            </DialogTitle>
          </DialogHeader>

          {editing ? (
            <div className="space-y-3">
              <Textarea
                autoFocus
                rows={5}
                placeholder="כתוב הערה על הסשן…"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => (has ? setEditing(false) : setOpen(false))}
                  disabled={saving}
                >
                  ביטול
                </Button>
                <Button size="sm" onClick={save} disabled={saving}>
                  שמירה
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="whitespace-pre-wrap break-words text-sm text-foreground">{note}</p>
              <div className="flex justify-end">
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  עריכה
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
