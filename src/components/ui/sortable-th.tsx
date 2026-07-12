import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type SortDir = "asc" | "desc";

/** A sortable table header cell: shows the sort direction when active, and a
 *  neutral up/down glyph otherwise. Shared by the admin list tables (clients,
 *  leads, …) so they sort and look identical. */
export function SortableTh({
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
    <th className={cn("px-3 py-2 text-start font-medium", className)}>
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
