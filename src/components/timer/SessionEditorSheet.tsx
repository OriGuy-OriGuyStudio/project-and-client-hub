import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SelectMenu } from "@/components/ui/select-menu";
import { cn } from "@/lib/utils";
import { useProjects } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { clientLabel } from "@/components/timer/timer-controls";
import {
  useProjectStages,
  useTimeLabels,
  createManualSession,
  updateSession,
  deleteSession,
  type SessionInput,
} from "@/hooks/useTimeData";
import type { TimeSession } from "@/types/database";

type Kind = "stage" | "personal";
type Mode = "up" | "down";

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Create a manual session or edit/delete an existing one. Opened from the
 * timer board and the reports list. A side Sheet, per the app convention for
 * add/edit forms.
 */
export function SessionEditorSheet({
  open,
  onOpenChange,
  session,
  presetCtx,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  session?: TimeSession | null;
  presetCtx?: { kind: Kind; clientId?: string | null; projectId?: string | null; stageId?: string | null; label?: string | null };
}) {
  const editing = !!session;
  const { data: projects = [] } = useProjects();
  const { data: clientsData } = useClients();
  const clients = clientsData?.active ?? [];
  const { labels } = useTimeLabels();

  const [kind, setKind] = useState<Kind>("stage");
  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [stageId, setStageId] = useState("");
  const [label, setLabel] = useState("");
  const [mode, setMode] = useState<Mode>("up");
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(25);
  const [startedLocal, setStartedLocal] = useState(toLocalInput(new Date().toISOString()));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: stages = [] } = useProjectStages(kind === "stage" ? projectId || null : null);
  const clientProjects = clientId ? projects.filter((p) => p.client_id === clientId) : [];

  // (Re)initialise whenever the sheet opens.
  useEffect(() => {
    if (!open) return;
    if (session) {
      setKind(session.kind);
      // fall back to the project's client if an older session has no client_id
      setClientId(session.client_id ?? projects.find((p) => p.id === session.project_id)?.client_id ?? "");
      setProjectId(session.project_id ?? "");
      setStageId(session.stage_id ?? "");
      setLabel(session.label ?? "");
      setMode(session.mode);
      setHours(Math.floor(session.duration_seconds / 3600));
      setMinutes(Math.round((session.duration_seconds % 3600) / 60));
      setStartedLocal(toLocalInput(session.started_at));
      setNote(session.note ?? "");
    } else {
      setKind(presetCtx?.kind ?? "stage");
      setClientId(presetCtx?.clientId ?? "");
      setProjectId(presetCtx?.projectId ?? "");
      setStageId(presetCtx?.stageId ?? "");
      setLabel(presetCtx?.label ?? "");
      setMode("up");
      setHours(0);
      setMinutes(25);
      setStartedLocal(toLocalInput(new Date().toISOString()));
      setNote("");
    }
  }, [open, session, presetCtx, projects]);

  const durationSec = hours * 3600 + minutes * 60;
  const valid = durationSec > 0 && (kind === "stage" ? !!clientId : !!label);

  async function submit() {
    if (!valid) return;
    setSaving(true);
    // personal labels linked to a project keep counting toward it
    const linkedProject = labels.find((l) => l.name === label)?.project_id ?? null;
    const input: SessionInput = {
      kind,
      client_id: kind === "stage" ? clientId || null : null,
      project_id: kind === "stage" ? projectId || null : linkedProject,
      stage_id: kind === "stage" ? stageId || null : null,
      label: kind === "personal" ? label || null : null,
      mode,
      duration_seconds: durationSec,
      started_at: new Date(startedLocal).toISOString(),
      note: note.trim() || null,
    };
    const ok = session ? await updateSession(session.id, input) : await createManualSession(input);
    setSaving(false);
    if (ok) onOpenChange(false);
  }

  async function remove() {
    if (!session) return;
    if (!window.confirm("למחוק את הסשן? הפעולה בלתי הפיכה.")) return;
    setSaving(true);
    const ok = await deleteSession(session.id);
    setSaving(false);
    if (ok) onOpenChange(false);
  }

  const seg = (active: boolean) =>
    cn(
      "flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors",
      active ? "bg-primary text-[color:var(--ink,#0a0623)]" : "text-muted-foreground",
    );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{editing ? "עריכת סשן" : "הוספת זמן ידנית"}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* kind */}
          <div className="flex gap-1 rounded-xl border border-border/60 bg-background/40 p-1">
            <button className={seg(kind === "stage")} onClick={() => setKind("stage")}>
              פרויקט
            </button>
            <button className={seg(kind === "personal")} onClick={() => setKind("personal")}>
              אישי
            </button>
          </div>

          {kind === "stage" ? (
            <div className="space-y-2">
              <SelectMenu
                variant="field"
                placeholder="בחר לקוח…"
                value={clientId}
                onChange={(v) => {
                  setClientId(v);
                  setProjectId("");
                  setStageId("");
                }}
                options={clients.map((c) => ({ value: c.id, label: clientLabel(c) }))}
                ariaLabel="לקוח"
              />
              <SelectMenu
                variant="field"
                disabled={!clientId}
                placeholder={
                  !clientId ? "בחר לקוח קודם" : clientProjects.length ? "פרויקט (רשות)" : "אין פרויקט ללקוח"
                }
                value={projectId}
                onChange={(v) => {
                  setProjectId(v);
                  setStageId("");
                }}
                options={[
                  { value: "", label: "ללא פרויקט (טרום)" },
                  ...clientProjects.map((p) => ({ value: p.id, label: p.title })),
                ]}
                ariaLabel="פרויקט"
              />
              <SelectMenu
                variant="field"
                disabled={!projectId}
                placeholder={!projectId ? "—" : stages.length ? "בחר שלב…" : "אין שלבים"}
                value={stageId}
                onChange={setStageId}
                options={[{ value: "", label: "ללא שלב" }, ...stages.map((s) => ({ value: s.id, label: s.title }))]}
                ariaLabel="שלב"
              />
            </div>
          ) : (
            <SelectMenu
              variant="field"
              placeholder="בחר תווית…"
              value={label}
              onChange={setLabel}
              options={labels.map((l) => ({ value: l.name, label: l.name }))}
              ariaLabel="תווית"
            />
          )}

          {/* mode */}
          <div className="flex gap-1 rounded-xl border border-border/60 bg-background/40 p-1">
            <button className={seg(mode === "up")} onClick={() => setMode("up")}>
              משימה
            </button>
            <button className={seg(mode === "down")} onClick={() => setMode("down")}>
              פומודורו
            </button>
          </div>

          {/* duration */}
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">משך</p>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={hours}
                  onChange={(e) => setHours(Math.max(0, Math.min(23, parseInt(e.target.value || "0", 10))))}
                  className="w-16 text-center"
                />
                <span className="text-sm text-muted-foreground">שעות</span>
              </div>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  max={59}
                  value={minutes}
                  onChange={(e) => setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value || "0", 10))))}
                  className="w-16 text-center"
                />
                <span className="text-sm text-muted-foreground">דקות</span>
              </div>
            </div>
          </div>

          {/* start */}
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">התחלה</p>
            <Input
              type="datetime-local"
              value={startedLocal}
              onChange={(e) => setStartedLocal(e.target.value)}
              className="w-full"
            />
          </div>

          {/* note */}
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">הערה (רשות)</p>
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="על מה עבדת…" />
          </div>
        </div>

        <SheetFooter className="mt-6 flex-row items-center justify-between gap-2">
          {editing ? (
            <Button variant="ghost" size="sm" className="text-destructive" onClick={remove} disabled={saving}>
              <Trash2 className="size-4" /> מחיקה
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
              ביטול
            </Button>
            <Button onClick={submit} disabled={!valid || saving}>
              {editing ? "שמירה" : "הוספה"}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
