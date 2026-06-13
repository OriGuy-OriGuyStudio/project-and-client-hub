import { cn } from "@/lib/utils";

/** Copyright line with an always-current year (no manual upkeep). */
export function Copyright({ className }: { className?: string }) {
  const year = new Date().getFullYear();
  return (
    <span className={cn(className)}>
      © {year} סטודיו אורי גיא
      <span className="hidden sm:inline"> · כל הזכויות שמורות</span>
    </span>
  );
}
