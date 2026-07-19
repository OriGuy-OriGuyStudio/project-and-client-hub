import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, Compass, ExternalLink, FileText, Network, Route, Sparkles, Users } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  usePublishedPersonas,
  usePublishedJourney,
  usePublishedSitemap,
  useProjectDiscoveryShare,
} from "@/hooks/useDeliverables";
import { PersonaBody } from "@/components/project/PersonaSection";
import { JourneyBody } from "@/components/project/JourneySection";
import { SitemapBody } from "@/components/project/SitemapSection";

/**
 * "אפיון האתר": one collapsible panel that consolidates the three discovery
 * deliverables (personas, customer journey, sitemap) into internal tabs, instead
 * of three separate stacked sections. Only tabs with published content are shown,
 * and the whole panel hides when there's nothing published. When the discovery
 * call has a shared summary, it links to it up top (works for clients too).
 */
export function SiteBlueprintPanel({
  projectId,
  isAdmin = false,
}: {
  projectId: string;
  /** Admin gets the export links (the internal version must never be one click
   *  away for a client). */
  isAdmin?: boolean;
}) {
  const { data: personas } = usePublishedPersonas(projectId);
  const { data: journey } = usePublishedJourney(projectId);
  const { data: sitemap } = usePublishedSitemap(projectId);
  const { data: share } = useProjectDiscoveryShare(projectId);
  const [open, setOpen] = useState(true);
  const [active, setActive] = useState<string | null>(null);

  const tabs = [
    { key: "persona", label: "פרסונות", icon: Users, has: (personas?.length ?? 0) > 0 },
    { key: "journey", label: "מסע לקוח", icon: Route, has: !!journey },
    { key: "sitemap", label: "מפת אתר", icon: Network, has: !!sitemap },
  ].filter((t) => t.has);

  // Nothing published: clients see no panel at all. The admin still gets it
  // when a discovery call exists, since the spec export is built from the
  // discovery too and would otherwise be unreachable from the project page.
  const adminOnlyDiscovery = tabs.length === 0 && isAdmin && !!share?.token;
  if (tabs.length === 0 && !adminOnlyDiscovery) return null;
  const activeKey = active && tabs.some((t) => t.key === active) ? active : tabs[0]?.key;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-5 text-start">
          <div className="flex items-center gap-2">
            <Compass className="size-5 text-primary" />
            <span className="font-heading text-lg font-semibold text-foreground">אפיון האתר</span>
          </div>
          <ChevronDown
            className={cn("size-5 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-4 px-5 pb-6">
          {share?.token && (
            <a
              href={`/discovery/${share.token}`}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground transition-colors hover:border-primary/40"
            >
              <Sparkles className="size-4 text-primary" />
              סיכום שיחת האפיון
              <ExternalLink className="size-3.5 text-muted-foreground" />
            </a>
          )}

          {tabs.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setActive(t.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    activeKey === t.key
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-muted"
                  )}
                >
                  <t.icon className="size-4" />
                  {t.label}
                </button>
              ))}
            </div>
          )}

          <div>
            {activeKey === "persona" && <PersonaBody projectId={projectId} />}
            {activeKey === "journey" && <JourneyBody projectId={projectId} />}
            {activeKey === "sitemap" && <SitemapBody projectId={projectId} />}
          </div>

          {/* Admin only: one printable document out of everything above plus
             the discovery call. Two versions, because the internal design
             notes must not reach the client (see lib/project-spec.ts). */}
          {isAdmin && (
            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <span className="text-xs text-muted-foreground">יצוא מסמך אפיון:</span>
              <Link
                to={`/admin/projects/${projectId}/spec?mode=client`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40"
              >
                <FileText className="size-3.5 text-primary" />
                גרסה ללקוח
              </Link>
              <Link
                to={`/admin/projects/${projectId}/spec?mode=full`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40"
              >
                <FileText className="size-3.5 text-primary" />
                גרסה מלאה (פנימית)
              </Link>
            </div>
          )}
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
