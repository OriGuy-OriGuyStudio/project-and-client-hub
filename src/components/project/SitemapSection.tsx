import { useState } from "react";
import { ChevronDown, CornerDownRight, FileText, Lightbulb, Route } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePublishedSitemap } from "@/hooks/useDeliverables";
import type { SitemapContent, SitemapPage } from "@/types/database";

/** Client-facing sitemap as a page tree. Each page is a stacked "skeleton" of its
 *  sections in order (like the real page, block by block) rather than a wall of
 *  chips; the order rationale is tucked behind a toggle. The "מפת אתר" tab body of
 *  the site-blueprint panel; null when there is no published sitemap. */
export function SitemapBody({ projectId }: { projectId: string }) {
  const { data } = usePublishedSitemap(projectId);
  if (!data) return null;
  const sitemap = data.content as unknown as SitemapContent;
  if (!sitemap.pages?.length) return null;
  return (
    <div className="space-y-3">
      {sitemap.pages.map((p, i) => (
        <PageCard key={i} p={p} />
      ))}
    </div>
  );
}

/** "Serves" shown as its own line under the title (consistent placement, never
 *  wrapping to the side of the heading). */
function Serves({ serves }: { serves: string }) {
  if (!serves?.trim()) return null;
  return (
    <p className="mt-1 flex items-start gap-1 text-xs text-muted-foreground">
      <Route className="mt-0.5 size-3 shrink-0" />
      <span className="min-w-0 break-words">{serves}</span>
    </p>
  );
}

/** The page's sections as a numbered vertical stack, mirroring how the blocks
 *  are actually stacked on the page, top to bottom. */
function SectionStack({ sections }: { sections: string[] }) {
  if (!sections?.length) return null;
  return (
    <div className="mt-2 flex flex-col gap-1.5">
      {sections.map((s, i) => (
        <div key={i} className="flex items-start gap-2.5 rounded-md bg-muted px-3 py-2">
          <span className="mt-0.5 w-4 shrink-0 text-[11px] tabular-nums text-muted-foreground">{i + 1}</span>
          <span className="min-w-0 break-words text-sm font-medium text-foreground">{s}</span>
        </div>
      ))}
    </div>
  );
}

/** Collapsible "why this order" note, closed by default to avoid a wall of text. */
function OrderRationale({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  if (!text?.trim()) return null;
  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="inline-flex items-center gap-1.5 text-xs text-primary transition-colors hover:text-primary/80"
      >
        <Lightbulb className="size-3.5" />
        למה הסדר הזה?
        <ChevronDown className={cn("size-3.5 transition-transform", show && "rotate-180")} />
      </button>
      {show && (
        <p className="mt-1.5 rounded-lg bg-primary/5 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          {text}
        </p>
      )}
    </div>
  );
}

function PageCard({ p }: { p: SitemapPage }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <FileText className="size-4 shrink-0 text-primary" />
        <span className="min-w-0 break-words font-heading text-base font-semibold text-foreground">{p.name}</span>
      </div>
      <Serves serves={p.serves} />
      {p.purpose && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.purpose}</p>}
      <SectionStack sections={p.sections} />
      <OrderRationale text={p.order_rationale ?? ""} />

      {p.children?.length > 0 && (
        <div className="mt-3 space-y-2 border-s-2 border-border ps-3">
          {p.children.map((c, i) => (
            <div key={i} className="overflow-hidden rounded-lg border border-border bg-background/40 p-3">
              <div className="flex items-center gap-1.5">
                <CornerDownRight className="size-3.5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 break-words text-sm font-medium text-foreground">{c.name}</span>
              </div>
              <Serves serves={c.serves} />
              {c.purpose && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{c.purpose}</p>}
              <SectionStack sections={c.sections} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
