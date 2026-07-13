import { useState, type ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/**
 * Shared project-page section card: a title header that doubles as a collapse
 * toggle, an optional actions slot (header buttons stay clickable, outside the
 * trigger), and the collapsible body. Every project section uses this so they
 * all look and collapse the same way.
 */
export function SectionShell({
  icon: Icon,
  iconClass,
  title,
  actions,
  defaultOpen = true,
  children,
}: {
  icon: LucideIcon;
  iconClass?: string;
  title: string;
  actions?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card className="p-5">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center justify-between gap-2">
          <CollapsibleTrigger className="flex min-w-0 flex-1 items-center gap-2 text-start">
            <Icon className={cn("size-5 shrink-0", iconClass ?? "text-primary")} />
            <span className="truncate font-heading text-lg font-semibold text-foreground">{title}</span>
          </CollapsibleTrigger>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            <CollapsibleTrigger
              aria-label={open ? "כווץ" : "הרחב"}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronDown className={cn("size-5 transition-transform", open && "rotate-180")} />
            </CollapsibleTrigger>
          </div>
        </div>
        <CollapsibleContent className="pt-4">{children}</CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
