// Quote system v2.1 , automation classification guide (Task 5, final task of the
// v2.1 rebuild). Static, in-app reference so Ori can classify an automation quote
// consistently without re-deriving the criteria each time. No schema, no state
// beyond the open/closed toggle. Content is the guide Ori approved , see
// docs/superpowers/specs/2026-07-16-quote-v2.1-content-model-design.md §4.

import { useState } from "react";
import { ChevronDown, Workflow } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

type GuideLevel = {
  name: string;
  systems: string;
  directionality: string;
  logic: string;
  errorHandling: string;
  example: string;
};

const LEVELS: GuideLevel[] = [
  {
    name: "פשוטה",
    systems: "1-2 מערכות",
    directionality: "כיוון אחד",
    logic: "זרימה לינארית, בלי תנאים",
    errorHandling: "בסיסי",
    example: "טופס לידים אחד ➝ הוספת ליד ב-CRM",
  },
  {
    name: "בינונית",
    systems: "2-3 מערכות",
    directionality: "כיוון אחד, לפי סטטוס",
    logic: "תנאים / הסתעפויות, מיפוי ועיבוד נתונים",
    errorHandling: "התראה על כשל",
    example: "ליד חדש בפייסבוק ➝ בדיקת תנאי ➝ שיוך לנציג ב-CRM לפי אזור",
  },
  {
    name: "מורכבת",
    systems: "3+ מערכות",
    directionality: "סנכרון דו-כיווני",
    logic: "לוגיקה מתקדמת, אופציונלי רכיב AI",
    errorHandling: "טיפול שגיאות + retry + לוגים",
    example: "GHL+Workiz: פרסום (גוגל/מטא) ➝ GHL, ליד נסגר ב-GHL ➝ עבודה ב-Workiz, עבודה הושלמה ב-Workiz ➝ עדכון סטטוס ב-GHL",
  },
];

/** Collapsible reference card for classifying an automation quote into
 *  simple/medium/complex (+ the always-included base). Rendered in the
 *  builder's "הגדרה" tab only when content.type === 'automation'
 *  (see QuoteBuilder.tsx). Pure display, no props. */
export function AutomationGuide() {
  const [open, setOpen] = useState(true);
  return (
    <Card className="p-5">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center justify-between gap-2">
          <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-start">
            <Workflow className="size-5 shrink-0 text-primary" />
            <span className="truncate font-heading text-base font-semibold text-foreground">
              מדריך סיווג אוטומציה
            </span>
          </CollapsibleTrigger>
          <CollapsibleTrigger
            aria-label={open ? "כווץ" : "הרחב"}
            className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronDown className={cn("size-5 transition-transform", open && "rotate-180")} />
          </CollapsibleTrigger>
        </div>
        <CollapsibleContent className="space-y-4 pt-4">
          <p className="text-xs text-muted-foreground">
            כל הצעת אוטומציה כוללת בסיס קבוע (הקמה + אוטומציה אחת). הרמה שמעליו נקבעת לפי 4 קריטריונים: כמות
            המערכות, כיווניות הסנכרון, מורכבות הלוגיקה, וטיפול בשגיאות.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-start text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground">
                  <th className="p-2 text-start font-medium">רמה</th>
                  <th className="p-2 text-start font-medium">מערכות</th>
                  <th className="p-2 text-start font-medium">כיווניות</th>
                  <th className="p-2 text-start font-medium">לוגיקה</th>
                  <th className="p-2 text-start font-medium">טיפול שגיאות</th>
                </tr>
              </thead>
              <tbody>
                {LEVELS.map((lvl) => (
                  <tr key={lvl.name} className="border-b border-border/60 align-top">
                    <td className="p-2 font-semibold text-foreground">{lvl.name}</td>
                    <td className="p-2 text-muted-foreground">{lvl.systems}</td>
                    <td className="p-2 text-muted-foreground">{lvl.directionality}</td>
                    <td className="p-2 text-muted-foreground">{lvl.logic}</td>
                    <td className="p-2 text-muted-foreground">{lvl.errorHandling}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-2">
            {LEVELS.map((lvl) => (
              <p key={lvl.name} className="rounded-lg bg-primary/5 p-2.5 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">דוגמה ({lvl.name}): </span>
                {lvl.example}
              </p>
            ))}
          </div>

          <p className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 text-xs text-muted-foreground">
            <span className="font-semibold text-primary">דוגמה מלאה, GHL+Workiz: </span>
            פרסום בגוגל/מטא מזרים לידים ל-GHL, ליד שנסגר ב-GHL פותח עבודה ב-Workiz, ועבודה שהושלמה ב-Workiz מעדכנת
            את הסטטוס חזרה ב-GHL. שלוש מערכות, סנכרון דו-כיווני, לוגיקה מתקדמת , מסווגת כ״מורכבת״.
          </p>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
