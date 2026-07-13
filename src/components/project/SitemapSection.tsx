import { useState } from "react";
import { ChevronDown, CornerDownRight, FileText, Lightbulb, Network, Route } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { usePublishedSitemap } from "@/hooks/useDeliverables";
import type { SitemapContent, SitemapPage } from "@/types/database";

/** Client-facing "מפת האתר": the published sitemap as a page tree (main pages +
 *  sub-pages), each showing purpose, sections, and which journey stage it serves.
 *  Whole section is collapsible. Hidden when there is no published sitemap. */
export function SitemapSection({ projectId }: { projectId: string }) {
  const { data } = usePublishedSitemap(projectId);
  const [open, setOpen] = useState(true);
  if (!data) return null;
  const sitemap = data.content as unknown as SitemapContent;
  if (!sitemap.pages?.length) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <section className="space-y-3">
        <CollapsibleTrigger className="flex w-full items-center gap-2 text-start">
          <Network className="size-5 text-primary" />
          <h2 className="font-heading text-lg font-bold text-foreground">
            {sitemap.title?.trim() || "מפת האתר"}
          </h2>
          <ChevronDown
            className={cn("ms-auto size-5 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-3">
          {sitemap.pages.map((p, i) => (
            <PageCard key={i} p={p} />
          ))}
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}

function Serves({ serves }: { serves: string }) {
  if (!serves?.trim()) return null;
  return (
    <span className="flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-0.5 text-xs text-primary">
      <Route className="size-3" />
      {serves}
    </span>
  );
}

function Sections({ sections }: { sections: string[] }) {
  if (!sections?.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {sections.map((s, i) => (
        <span key={i} className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
          {s}
        </span>
      ))}
    </div>
  );
}

function PageCard({ p }: { p: SitemapPage }) {
  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <FileText className="size-4 shrink-0 text-primary" />
          <span className="font-heading text-base font-semibold text-foreground">{p.name}</span>
        </span>
        <Serves serves={p.serves} />
      </div>
      {p.purpose && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.purpose}</p>}
      <Sections sections={p.sections} />
      {p.order_rationale?.trim() && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-primary/5 px-2.5 py-1.5 text-xs leading-relaxed text-muted-foreground">
          <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-primary" />
          <span>{p.order_rationale}</span>
        </p>
      )}

      {p.children?.length > 0 && (
        <div className="mt-3 space-y-2 border-s-2 border-border ps-3">
          {p.children.map((c, i) => (
            <div key={i} className="rounded-lg border border-border bg-background/40 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground" />
                  <span className="text-sm font-medium text-foreground">{c.name}</span>
                </span>
                <Serves serves={c.serves} />
              </div>
              {c.purpose && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.purpose}</p>}
              <Sections sections={c.sections} />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
