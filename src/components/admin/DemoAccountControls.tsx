import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SelectMenu } from "@/components/ui/select-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cloneIntoDemo, resetDemo } from "@/lib/demo";
import { toast, toastError } from "@/hooks/use-toast";

export interface DemoSource {
  id: string;
  label: string;
}

/**
 * Admin QA controls on a demo account: load a real user's data into the demo
 * (so Ori can log in as the demo and see exactly what that user sees), or reset
 * the demo back to empty. The source user is never modified.
 */
export function DemoAccountControls({
  demoId,
  role,
  sources,
}: {
  demoId: string;
  role: "client" | "partner";
  sources: DemoSource[];
}) {
  const qc = useQueryClient();
  const [pick, setPick] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [sourceId, setSourceId] = useState("");
  const [busy, setBusy] = useState(false);

  const word = role === "partner" ? "שותף" : "לקוח";

  function refresh() {
    // Broad refresh — the clone/reset touches many tables across the app.
    qc.invalidateQueries();
  }

  async function doClone() {
    if (!sourceId) return;
    setBusy(true);
    try {
      await cloneIntoDemo(demoId, sourceId);
      toast({ title: "הנתונים הועתקו לחשבון הדמה ✓", variant: "success" });
      setPick(false);
      setSourceId("");
      refresh();
    } catch {
      toastError("העתקת הנתונים נכשלה.");
    } finally {
      setBusy(false);
    }
  }

  async function doReset() {
    setBusy(true);
    try {
      await resetDemo(demoId);
      toast({ title: "חשבון הדמה אופס ✓", variant: "success" });
      setConfirmReset(false);
      refresh();
    } catch {
      toastError("האיפוס נכשל.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="-mt-1 mb-1 flex flex-wrap items-center gap-2 ps-1">
      <Button variant="outline" size="sm" onClick={() => setPick(true)}>
        <Download className="size-4" />
        טען נתונים מ{word}
      </Button>
      <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setConfirmReset(true)}>
        <RotateCcw className="size-4" />
        איפוס
      </Button>

      <Dialog open={pick} onOpenChange={(o) => !o && setPick(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>טעינת נתונים מ{word}</DialogTitle>
            <DialogDescription>
              בחר {word} אמיתי, והמערכת תעתיק את הנתונים שלו לחשבון הדמה כדי שתוכל
              לראות בדיוק מה שהוא רואה. ההתחברות של הדמה נשארת, וה{word} עצמו לא משתנה.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-1.5">
            <SelectMenu
              variant="field"
              ariaLabel={`בחירת ${word}`}
              placeholder={`בחר ${word}…`}
              value={sourceId}
              onChange={setSourceId}
              options={sources.map((s) => ({ value: s.id, label: s.label }))}
            />
          </div>

          <DialogFooter>
            <Button onClick={doClone} disabled={busy || !sourceId}>
              {busy ? "טוען…" : "טען נתונים"}
            </Button>
            <Button variant="ghost" onClick={() => setPick(false)}>ביטול</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmReset} onOpenChange={(o) => !o && setConfirmReset(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>איפוס חשבון הדמה</DialogTitle>
            <DialogDescription>
              פעולה זו תמחק את כל הנתונים שנטענו לחשבון הדמה ותחזיר אותו למצב ריק.
              חשבונות אמיתיים לא מושפעים.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="destructive" onClick={doReset} disabled={busy}>
              {busy ? "מאפס…" : "אפס לריק"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>ביטול</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
