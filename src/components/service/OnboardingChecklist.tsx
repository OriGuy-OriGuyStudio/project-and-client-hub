import { useEffect, useState } from "react";
import { ListChecks, Check, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// A fixed reminder checklist for onboarding a new maintenance client. Static
// content, but ticks persist in localStorage so a mid-onboarding close doesn't
// lose the place. "אתחל" clears it for the next client.
const STORAGE_KEY = "maint-onboarding-checklist-v1";

type Step = { id: string; label: string; hint?: string };
type Group = { title: string; steps: Step[] };

const GROUPS: Group[] = [
  {
    title: "בפורטל",
    steps: [
      { id: "open", label: 'פתח את הפרויקט של הלקוח ולחץ "עריכת פרויקט".' },
      { id: "tier", label: 'בקטע "תוכנית שירות ותחזוקה" בחר Tier (core / pro / ultra).' },
      { id: "type", label: 'בחר "סוג אתר" (למשל WordPress).' },
      {
        id: "url",
        label: 'הזן את "כתובת האתר" המדויקת (https://...).',
        hint: "זה השדה שממנו נמשכות כל המטריקות. ה־host שלו הוא המפתח שמחבר Uptime ותעבורה ללקוח.",
      },
      { id: "billing", label: "הגדר יום חיוב ותעריף שעתי (אם רלוונטי), ולחץ שמור." },
    ],
  },
  {
    title: "חיבור הניטור לאתר (חד-פעמי לכל אתר)",
    steps: [
      {
        id: "uptime",
        label: "UptimeRobot: צור Monitor חדש עם אותו URL בדיוק.",
        hint: "ה־host של ה־Monitor חייב להיות זהה לכתובת שהזנת בחבילה, אחרת הזמינות לא תוצמד ללקוח.",
      },
      {
        id: "cf-add",
        label: "Cloudflare: הוסף את הדומיין של הלקוח ל־Web Analytics (Add a site).",
        hint: "בלי להוסיף את הדומיין כאן, אין site שאליו נכנסת התעבורה, והפורטל יראה 0.",
      },
      {
        id: "cf-beacon",
        label: "Cloudflare: העתק את סקריפט הביקון (JS Snippet) והתקן אותו באתר.",
        hint: "בוורדפרס: דרך תוסף שמכניס קוד ל־Footer (למשל WPCode / Insert Headers and Footers).",
      },
      { id: "psi", label: "PageSpeed: לא דורש כלום, רץ אוטומטית דרך המפתח הגלובלי." },
    ],
  },
  {
    title: "הפעלה ובדיקה",
    steps: [
      { id: "refresh", label: 'אדמין → חבילות תחזוקה → "רענן נתונים עכשיו".' },
      {
        id: "verify",
        label: 'ודא שהלקוח רואה ב"השירות שלך": מהירות, זמינות, ותעבורה.',
        hint: "תעבורה מתמלאת רק אחרי שהביקון הותקן ונאספה תנועה, אז ייתכן שיעברו כמה שעות.",
      },
      { id: "report", label: "(רשות) שלח את הדוח החודשי הראשון." },
    ],
  },
];

const ALL_STEPS = GROUPS.flatMap((g) => g.steps);

export function OnboardingChecklist() {
  const [done, setDone] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setDone(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  function persist(next: Record<string, boolean>) {
    setDone(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  }

  const toggle = (id: string) => persist({ ...done, [id]: !done[id] });
  const reset = () => persist({});

  const doneCount = ALL_STEPS.filter((s) => done[s.id]).length;
  const total = ALL_STEPS.length;
  const allDone = doneCount === total;

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="sm" variant="outline">
          <ListChecks className="size-4" /> לקוח חדש? צ'ק-ליסט
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ListChecks className="size-5 text-primary" /> קליטת לקוח תחזוקה חדש
          </SheetTitle>
          <SheetDescription>
            כל השלבים כדי שלקוח חדש יראה ניטור חי ב"השירות שלך". סמן תוך כדי, ההתקדמות נשמרת.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className={cn("font-semibold", allDone ? "text-primary" : "text-foreground")}>{doneCount}</span>
            <span className="text-muted-foreground">/ {total} הושלמו</span>
          </div>
          <Button size="sm" variant="ghost" onClick={reset} className="text-muted-foreground">
            <RotateCcw className="size-4" /> אתחל ללקוח חדש
          </Button>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${total ? (doneCount / total) * 100 : 0}%` }}
          />
        </div>

        <div className="mt-6 space-y-6">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</h4>
              <div className="space-y-1.5">
                {group.steps.map((step) => {
                  const checked = !!done[step.id];
                  return (
                    <button
                      key={step.id}
                      type="button"
                      onClick={() => toggle(step.id)}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl border p-3 text-start transition-colors",
                        checked ? "border-primary/40 bg-primary/5" : "border-border/60 hover:bg-muted/50",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                          checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                        )}
                      >
                        {checked && <Check className="size-3.5" strokeWidth={3} />}
                      </span>
                      <span className="flex-1">
                        <span className={cn("block text-sm", checked && "text-muted-foreground line-through")}>
                          {step.label}
                        </span>
                        {step.hint && (
                          <span className="mt-1 block text-xs text-muted-foreground">{step.hint}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
