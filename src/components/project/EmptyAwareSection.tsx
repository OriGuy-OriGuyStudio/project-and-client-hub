import { useState, type ReactNode } from "react";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

/**
 * Keeps a fresh project page tidy for admin-populated ("passive") sections the
 * client can't add to: when the section is empty it's hidden from the client
 * entirely, and shown to the admin as one collapsed line they can expand to fill
 * it in. When the section has content, it renders normally. Sections the client
 * can act on (files, docs, feedback, chat) don't use this wrapper.
 */
export function EmptyAwareSection({
  isAdmin,
  isEmpty,
  title,
  icon: Icon,
  children,
}: {
  isAdmin: boolean;
  isEmpty: boolean;
  title: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  // Client never sees an empty admin-populated section.
  if (isEmpty && !isAdmin) return null;

  // Non-empty: render normally in its own section slot.
  if (!isEmpty) {
    return (
      <div data-reveal data-section className="scroll-mt-20">
        {children}
      </div>
    );
  }

  // Empty + admin: one collapsed line the admin can expand to fill in.
  return (
    <div data-reveal data-section className="scroll-mt-20">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border bg-card/40 px-4 py-3 text-start transition-colors hover:border-primary/40">
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <span className="font-heading text-sm font-semibold text-foreground">{title}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">ריק</span>
          <ChevronDown
            className={cn("ms-auto size-4 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">{children}</CollapsibleContent>
      </Collapsible>
    </div>
  );
}
