import { useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { usePublishedCopy } from "@/hooks/useDeliverables";
import type { CopyContent, SiteCopyPage, SiteCopySection } from "@/types/database";

/** Client-facing site copy: the published draft copy, page by page (each a
 *  collapsible card), section by section. The "תוכן" tab body of the site-blueprint
 *  panel; null when there is no published copy. */
export function CopyBody({ projectId }: { projectId: string }) {
  const { data } = usePublishedCopy(projectId);
  if (!data) return null;
  const copy = data.content as unknown as CopyContent;
  if (!copy.pages?.length) return null;
  return (
    <div className="space-y-3">
      {copy.pages.map((p, i) => (
        <CopyPageCard key={i} page={p} defaultOpen={i === 0} />
      ))}
    </div>
  );
}

function CopyPageCard({ page, defaultOpen }: { page: SiteCopyPage; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);
  const sections = (page.sections ?? []).filter(
    (s) => s.heading?.trim() || s.subheading?.trim() || s.body?.trim() || s.cta?.trim()
  );
  if (sections.length === 0) return null;
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className="p-4">
        <CollapsibleTrigger className="flex w-full items-center gap-2 text-start">
          <FileText className="size-4 shrink-0 text-primary" />
          <span className="font-heading text-base font-semibold text-foreground">{page.name}</span>
          <ChevronDown
            className={cn("ms-auto size-4 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3 pt-3">
          {sections.map((s, i) => (
            <CopySectionBlock key={i} section={s} />
          ))}
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function CopySectionBlock({ section }: { section: SiteCopySection }) {
  return (
    <div className="rounded-xl border border-border bg-background/30 p-3">
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {section.name}
      </p>
      {section.heading?.trim() && (
        <p className="font-heading text-base font-semibold leading-snug text-foreground">
          {section.heading}
        </p>
      )}
      {section.subheading?.trim() && (
        <p className="mt-0.5 text-sm text-muted-foreground">{section.subheading}</p>
      )}
      {section.body?.trim() && (
        <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
          {section.body}
        </p>
      )}
      {section.cta?.trim() && (
        <span className="mt-2 inline-flex items-center rounded-lg bg-primary/15 px-3 py-1 text-sm font-medium text-primary">
          {section.cta}
        </span>
      )}
    </div>
  );
}
