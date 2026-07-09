import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Wrench, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectMenu } from "@/components/ui/select-menu";
import { supabase } from "@/lib/supabase";
import { toast, toastError } from "@/hooks/use-toast";
import { useMaintenanceLog } from "@/hooks/useService";
import type { MaintenanceLog } from "@/types/database";

const KIND_HE: Record<MaintenanceLog["kind"], string> = {
  update: "עדכון",
  backup: "גיבוי",
  scan: "סריקת אבטחה",
  deploy: "פריסה",
  service_call: "קריאת שירות",
  note: "הערה",
};

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Admin-only: log maintenance activity (updates, backups, service calls…) that
 *  the client sees on their "השירות שלך" page. Automation (n8n) can also write here. */
export function MaintenanceLogEditor({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const { data: log = [] } = useMaintenanceLog(projectId, 20);
  const [kind, setKind] = useState<MaintenanceLog["kind"]>("update");
  const [title, setTitle] = useState("");
  const [count, setCount] = useState("1");
  const [when, setWhen] = useState(toLocalInput(new Date().toISOString()));
  const [saving, setSaving] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["maintenance-log", projectId] });
    qc.invalidateQueries({ queryKey: ["service-summary", projectId] });
  };

  async function add() {
    setSaving(true);
    const { error } = await supabase.from("maintenance_log").insert({
      project_id: projectId,
      kind,
      title: title.trim() || null,
      count: Math.max(1, parseInt(count || "1", 10)),
      occurred_at: new Date(when).toISOString(),
    });
    setSaving(false);
    if (error) return toastError("שמירת הרשומה נכשלה.");
    setTitle("");
    setCount("1");
    toast({ title: "נוסף ליומן", variant: "success" });
    refresh();
  }

  async function remove(id: string) {
    const { error } = await supabase.from("maintenance_log").delete().eq("id", id);
    if (error) return toastError("המחיקה נכשלה.");
    refresh();
  }

  return (
    <Card className="p-5">
      <h2 className="mb-4 flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
        <Wrench className="size-5 text-primary" /> יומן תחזוקה (אדמין)
      </h2>

      <div className="grid gap-2 sm:grid-cols-[140px_1fr_70px_auto]">
        <SelectMenu
          variant="field"
          ariaLabel="סוג"
          value={kind}
          onChange={(v) => setKind(v as MaintenanceLog["kind"])}
          options={(Object.keys(KIND_HE) as MaintenanceLog["kind"][])
            .filter((k) => k !== "service_call")
            .map((k) => ({ value: k, label: KIND_HE[k] }))}
        />
        <Input placeholder="תיאור (רשות)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Input type="number" min={1} aria-label="כמות" value={count} onChange={(e) => setCount(e.target.value)} />
        <Button onClick={add} disabled={saving}>
          <Plus className="size-4" /> הוסף
        </Button>
      </div>
      <div className="mt-2">
        <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className="w-full sm:w-60" />
      </div>

      {log.length > 0 && (
        <div className="mt-4 divide-y divide-border/60">
          {log.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {KIND_HE[m.kind]}
                </span>
                <span className="truncate text-foreground">{m.title || KIND_HE[m.kind]}</span>
                {m.count > 1 && <span className="text-xs text-muted-foreground">×{m.count}</span>}
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {new Date(m.occurred_at).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" })}
                </span>
                <button
                  onClick={() => remove(m.id)}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="מחיקה"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        מה שמתועד כאן מופיע ללקוח בעמוד ״השירות שלך״ (עדכונים, גיבויים, קריאות שירות). האוטומציה תמלא כאן חלק אוטומטית בהמשך.
      </p>
    </Card>
  );
}
