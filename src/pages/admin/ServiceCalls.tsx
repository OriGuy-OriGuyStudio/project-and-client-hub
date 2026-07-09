import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { LifeBuoy, Paperclip, ExternalLink, Check, Play, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { CenteredLoader } from "@/components/ui/brand-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectMenu } from "@/components/ui/select-menu";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { getSignedUrl } from "@/lib/files";
import { toast, toastError } from "@/hooks/use-toast";
import { useProjects } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { clientLabel } from "@/components/timer/timer-controls";
import { useAllServiceCalls, updateServiceCall, adminOpenServiceCall, type ServiceCallRow } from "@/hooks/useService";
import { timer } from "@/lib/timer-store";
import type { ServiceCallStatus } from "@/types/database";

/** Admin opens a call on a client's behalf (something the studio found). */
function NewCallSheet() {
  const qc = useQueryClient();
  const { data: projects = [] } = useProjects();
  const { data: clientsData } = useClients();
  const clientNameById = new Map((clientsData?.active ?? []).map((c) => [c.id, clientLabel(c)]));
  // Show client + project so same-named projects (e.g. the internal studio) are
  // distinguishable, sorted by client then project title.
  const projectOptions = [...projects]
    .map((p) => ({
      value: p.id,
      client: clientNameById.get(p.client_id) ?? p.business_name ?? "",
      title: p.title,
    }))
    .sort((a, b) => a.client.localeCompare(b.client, "he") || a.title.localeCompare(b.title, "he"))
    .map((p) => ({ value: p.value, label: p.client ? `${p.client} · ${p.title}` : p.title }));
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!projectId) return toastError("בחר פרויקט.");
    if (!title.trim()) return toastError("תן כותרת לקריאה.");
    setBusy(true);
    const { error } = await adminOpenServiceCall(projectId, title.trim(), desc.trim());
    setBusy(false);
    if (error) return toastError("פתיחת הקריאה נכשלה.");
    setProjectId("");
    setTitle("");
    setDesc("");
    setOpen(false);
    qc.invalidateQueries({ queryKey: ["service-calls-all"] });
    qc.invalidateQueries({ queryKey: ["admin-tasks"] });
    toast({ title: "הקריאה נפתחה ונשלחה ללקוח", variant: "success" });
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm">
          <Plus className="size-4" /> קריאה חדשה
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>פתיחת קריאת שירות ללקוח</SheetTitle>
          <SheetDescription>
            קריאה שאתה פותח יזום. היא תופיע כאן, אצל הלקוח ב״השירות שלך״, והוא יקבל התראה.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>פרויקט</Label>
            <SelectMenu
              variant="field"
              ariaLabel="פרויקט"
              placeholder="בחר פרויקט…"
              value={projectId}
              onChange={setProjectId}
              options={projectOptions}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nc-title">כותרת</Label>
            <Input id="nc-title" maxLength={160} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="לדוגמה: מצאתי תקלה בטופס יצירת הקשר" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="nc-desc">תיאור (רשות)</Label>
            <Textarea id="nc-desc" rows={5} maxLength={4000} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="פרטים על מה שמצאת ומה נעשה." />
          </div>
        </div>
        <SheetFooter>
          <Button onClick={submit} disabled={busy}>
            {busy ? "פותח…" : "פתיחת הקריאה"}
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            ביטול
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

const STATUS_HE: Record<ServiceCallStatus, string> = {
  new: "חדשה",
  scheduled: "מתוזמנת",
  in_progress: "בטיפול",
  done: "טופלה",
  cancelled: "בוטלה",
};
const STATUS_ORDER: ServiceCallStatus[] = ["new", "scheduled", "in_progress", "done", "cancelled"];
const OPEN_STATUSES: ServiceCallStatus[] = ["new", "scheduled", "in_progress"];

function statusTone(s: ServiceCallStatus) {
  if (s === "new" || s === "scheduled") return "bg-brand-cyan-base/10 text-brand-cyan-base";
  if (s === "in_progress") return "bg-primary/15 text-primary";
  if (s === "done") return "bg-primary/15 text-primary";
  return "bg-muted text-muted-foreground";
}

async function openAttachment(path: string) {
  const url = await getSignedUrl(path);
  if (url) window.open(url, "_blank", "noopener");
  else toastError("פתיחת הקובץ נכשלה.");
}

function CallCard({ call }: { call: ServiceCallRow }) {
  const qc = useQueryClient();
  const [label, setLabel] = useState(call.admin_label ?? "");
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["service-calls-all"] });
    qc.invalidateQueries({ queryKey: ["admin-tasks"] });
    qc.invalidateQueries({ queryKey: ["service-calls", call.project_id] });
  };

  async function save(patch: { status?: ServiceCallStatus; admin_label?: string | null }) {
    setBusy(true);
    const { error } = await updateServiceCall(call.id, patch);
    setBusy(false);
    if (error) return toastError("העדכון נכשל.");
    toast({ title: "עודכן", variant: "success" });
    refresh();
  }

  function startTimer() {
    timer.start({
      kind: "stage",
      clientId: call.client_id ?? null,
      projectId: call.project_id,
      projectName: call.project_title,
      serviceCallId: call.id,
      serviceCallTitle: call.admin_label || call.title,
      stageId: null,
      stageName: null,
      retainer: true,
    });
    toast({ title: "הטיימר התחיל על הקריאה", variant: "success" });
  }

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <LifeBuoy className="size-4 shrink-0 text-primary" />
            <span className="text-xs text-muted-foreground">
              {call.client_name ?? "לקוח"} · {call.project_title ?? "פרויקט"} ·{" "}
              {new Date(call.created_at).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric" })}
            </span>
          </div>
          <p className="font-heading text-base font-semibold text-foreground">{call.title}</p>
          {call.description && (
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{call.description}</p>
          )}
          {call.attachments.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {call.attachments.map((a, i) => (
                <button
                  key={i}
                  onClick={() => openAttachment(a.path)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/40 px-2.5 py-1 text-xs text-foreground hover:border-primary/40"
                >
                  <Paperclip className="size-3.5" /> {a.name || "קובץ"}
                </button>
              ))}
            </div>
          )}
        </div>
        <span className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold", statusTone(call.status))}>
          {STATUS_HE[call.status]}
        </span>
      </div>

      <div className="mt-4 grid gap-2 border-t border-border/60 pt-3 sm:grid-cols-[1fr_170px_auto]">
        <div className="flex items-center gap-2">
          <Input
            placeholder="שם פנימי (רק לך)"
            value={label}
            maxLength={160}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={() => label.trim() !== (call.admin_label ?? "") && save({ admin_label: label.trim() || null })}
          />
        </div>
        <SelectMenu
          variant="field"
          ariaLabel="סטטוס"
          value={call.status}
          onChange={(v) => save({ status: v as ServiceCallStatus })}
          options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_HE[s] }))}
        />
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={startTimer} disabled={busy}>
            <Play className="size-4" /> טיימר
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link to={`/projects/${call.project_id}`}>
              פרויקט <ExternalLink className="size-3.5" />
            </Link>
          </Button>
          {call.status !== "done" && (
            <Button size="sm" onClick={() => save({ status: "done" })} disabled={busy}>
              <Check className="size-4" /> טופל
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

export default function ServiceCalls() {
  const { data: calls = [], isLoading } = useAllServiceCalls();
  const [filter, setFilter] = useState<"open" | ServiceCallStatus>("open");

  const shown = useMemo(() => {
    if (filter === "open") return calls.filter((c) => OPEN_STATUSES.includes(c.status));
    return calls.filter((c) => c.status === filter);
  }, [calls, filter]);

  const openCount = calls.filter((c) => OPEN_STATUSES.includes(c.status)).length;

  const tabs: { key: "open" | ServiceCallStatus; label: string }[] = [
    { key: "open", label: `פתוחות${openCount ? ` (${openCount})` : ""}` },
    { key: "done", label: "טופלו" },
    { key: "cancelled", label: "בוטלו" },
  ];

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <PageHeader title="קריאות שירות" subtitle="קריאות שלקוחות פתחו, או שאתה פותח יזום. ניהול סטטוס, שם פנימי ותיזמון עבודה." />
        <div className="pt-1">
          <NewCallSheet />
        </div>
      </div>

      {isLoading ? (
        <CenteredLoader label="טוען…" />
      ) : calls.length === 0 ? (
        <EmptyState icon={LifeBuoy} title="אין קריאות שירות" description="כשלקוח יפתח קריאת שירות היא תופיע כאן." />
      ) : (
        <div className="space-y-4">
          <div className="inline-flex flex-wrap gap-1 rounded-full border border-border/60 bg-card/60 p-1">
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setFilter(t.key)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors",
                  filter === t.key
                    ? "bg-primary text-[color:var(--ink,#0a0623)]"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">אין קריאות בקטגוריה הזו.</p>
          ) : (
            <div className="space-y-3">
              {shown.map((c) => (
                <CallCard key={c.id} call={c} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
