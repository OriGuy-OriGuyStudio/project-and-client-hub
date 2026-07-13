import { useState } from "react";
import { ChevronDown, Compass, ExternalLink, Network, Route, Sparkles, Users } from "lucide-react";
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
export function SiteBlueprintPanel({ projectId }: { projectId: string }) {
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

  if (tabs.length === 0) return null;
  const activeKey = active && tabs.some((t) => t.key === active) ? active : tabs[0].key;

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
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
