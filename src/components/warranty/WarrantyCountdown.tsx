import { differenceInCalendarDays } from "date-fns";
import { ShieldCheck, ShieldX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionShell } from "@/components/project/SectionShell";
import type { Project } from "@/types/database";

function formatHe(date: string) {
  return new Date(date).toLocaleDateString("he-IL");
}

/** Compact "active/expired" badge for cards and lists. */
export function WarrantyBadge({ project }: { project: Project }) {
  if (!project.warranty_end_date) return null;
  const active =
    differenceInCalendarDays(new Date(project.warranty_end_date), new Date()) >=
    0;
  return active ? (
    <Badge variant="success">
      <ShieldCheck className="size-3" /> אחריות פעילה
    </Badge>
  ) : (
    <Badge variant="secondary">
      <ShieldX className="size-3" /> אחריות פגה
    </Badge>
  );
}

/** Full "תמיכה ואחריות" section for the project page. */
export function WarrantyCountdown({ project }: { project: Project }) {
  if (!project.warranty_end_date) {
    return (
      <SectionShell icon={ShieldCheck} iconClass="text-muted-foreground" title="תמיכה ואחריות">
        <p className="text-sm text-muted-foreground">
          תקופת האחריות תיקבע עם השלמת הפרויקט.
        </p>
      </SectionShell>
    );
  }

  const end = new Date(project.warranty_end_date);
  const daysLeft = differenceInCalendarDays(end, new Date());
  const active = daysLeft >= 0;

  return (
    <SectionShell
      icon={active ? ShieldCheck : ShieldX}
      iconClass={active ? "text-brand-green-base" : "text-muted-foreground"}
      title="תמיכה ואחריות - Studio Pro"
    >
      {active ? (
        <p className="text-sm text-foreground">
          האחריות שלך פעילה עד:{" "}
          <span className="font-semibold">{formatHe(project.warranty_end_date)}</span>{" "}
          <span className="text-muted-foreground">
            | נותרו {daysLeft} ימים
          </span>
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          תקופת האחריות הסתיימה ב-{formatHe(project.warranty_end_date)}.
        </p>
      )}
    </SectionShell>
  );
}
