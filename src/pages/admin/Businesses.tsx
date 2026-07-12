import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUp, ArrowDown, ArrowUpDown, Building2, FolderKanban, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { useBusinesses } from "@/hooks/useBusinesses";
import type { BusinessRow } from "@/types/database";

type SortKey = "name" | "members" | "projects" | "last_activity";
type SortDir = "asc" | "desc";
type Sort = { key: SortKey; dir: SortDir };

function sortRows(rows: BusinessRow[], sort: Sort): BusinessRow[] {
  const { key, dir } = sort;
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (key === "name") return sign * a.name.localeCompare(b.name, "he");
    if (key === "last_activity") {
      return sign * (a.last_activity ?? "").localeCompare(b.last_activity ?? "");
    }
    return sign * (a[key] - b[key]);
  });
}

/** "פעילות אחרונה" as a short Hebrew date+time, or a dash when never active. */
function fmtActivity(iso: string | null) {
  if (!iso) return "אין פעילות";
  return new Date(iso).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" });
}

function SortableTh({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  className?: string;
}) {
  return (
    <th className={`px-3 py-2 text-start font-medium ${className ?? ""}`}>
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
      >
        {label}
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          )
        ) : (
          <ArrowUpDown className="size-3 opacity-40" />
        )}
      </button>
    </th>
  );
}

function BusinessTable({
  rows,
  sort,
  onSort,
}: {
  rows: BusinessRow[];
  sort: Sort;
  onSort: (key: SortKey) => void;
}) {
  const sorted = useMemo(() => sortRows(rows, sort), [rows, sort]);

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60">
            <SortableTh label="שם העסק" active={sort.key === "name"} dir={sort.dir} onClick={() => onSort("name")} />
            <SortableTh label="חברי צוות" active={sort.key === "members"} dir={sort.dir} onClick={() => onSort("members")} />
            <SortableTh label="פרויקטים" active={sort.key === "projects"} dir={sort.dir} onClick={() => onSort("projects")} />
            <SortableTh
              label="פעילות אחרונה"
              active={sort.key === "last_activity"}
              dir={sort.dir}
              onClick={() => onSort("last_activity")}
            />
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {sorted.map((r) => (
            <tr key={r.id} className="text-foreground">
              <td className="px-3 py-2.5">
                <Link
                  to={`/admin/businesses/${r.id}`}
                  className="flex min-w-0 items-center gap-2 font-medium hover:text-primary hover:underline"
                >
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                    <Building2 className="size-3.5" />
                  </span>
                  <span className="truncate">{r.name}</span>
                </Link>
              </td>
              <td className="px-3 py-2.5 tabular-nums">
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <Users className="size-3.5" /> {r.members}
                </span>
              </td>
              <td className="px-3 py-2.5 tabular-nums">
                <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                  <FolderKanban className="size-3.5" /> {r.projects}
                </span>
              </td>
              <td className="px-3 py-2.5 text-xs text-muted-foreground">{fmtActivity(r.last_activity)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Businesses() {
  const { data, isLoading, isError } = useBusinesses();
  const [sort, setSort] = useState<Sort>({ key: "name", dir: "asc" });

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  const real = (data ?? []).filter((r) => r.kind === "real");
  const demo = (data ?? []).filter((r) => r.kind === "demo");
  const studio = (data ?? []).filter((r) => r.kind === "studio");

  return (
    <div>
      <PageHeader
        title="לקוחות"
        subtitle="כל העסקים במערכת, לפי חברי הצוות, הפרויקטים והפעילות האחרונה שלהם."
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState icon={Users} title="טעינת העסקים נכשלה" />
      ) : !data?.length ? (
        <EmptyState
          icon={Building2}
          title="אין עדיין עסקים"
          description="ברגע שתוסיף לקוח ראשון, העסק שלו יופיע כאן."
        />
      ) : (
        <div className="space-y-6">
          {real.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">עסקים פעילים ({real.length})</h2>
              <BusinessTable rows={real} sort={sort} onSort={toggleSort} />
            </section>
          )}

          {demo.length > 0 && (
            <section className="space-y-2 rounded-2xl border border-dashed border-border/60 bg-background/20 p-3">
              <h2 className="text-sm font-medium text-amber-500">
                טסטים (דמה) , לא נספרים כלקוחות אמיתיים
              </h2>
              <BusinessTable rows={demo} sort={sort} onSort={toggleSort} />
            </section>
          )}

          {studio.length > 0 && (
            <section className="space-y-2 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-3">
              <h2 className="text-sm font-medium text-primary">
                סטודיו (פנימי) , לזמן על Orion / Chat / אדמיניסטרציה, לא נספר כלקוח
              </h2>
              <BusinessTable rows={studio} sort={sort} onSort={toggleSort} />
            </section>
          )}
        </div>
      )}
    </div>
  );
}
