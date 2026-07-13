import { useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  HeartHandshake,
  MapPin,
  Target,
  UserRound,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { usePublishedPersonas } from "@/hooks/useDeliverables";
import type { PersonaContent } from "@/types/database";

/** Client-facing "קהל היעד" section: the published personas for a project,
 *  stacked one below the other, each a collapsible card. Hidden when none. */
export function PersonaSection({ projectId }: { projectId: string }) {
  const { data } = usePublishedPersonas(projectId);
  const [open, setOpen] = useState(true);
  if (!data || data.length === 0) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <section className="space-y-3">
        <CollapsibleTrigger className="flex w-full items-center gap-2 text-start">
          <Users className="size-5 text-primary" />
          <h2 className="font-heading text-lg font-bold text-foreground">קהל היעד</h2>
          <ChevronDown
            className={cn("ms-auto size-5 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-3">
          {data.map((d, i) => (
            <PersonaCard key={d.id} p={d.content as unknown as PersonaContent} defaultOpen={i === 0} />
          ))}
        </CollapsibleContent>
      </section>
    </Collapsible>
  );
}

function Avatar({ url, className }: { url: string | null; className?: string }) {
  return (
    <div className={cn("shrink-0 overflow-hidden rounded-full bg-muted ring-1 ring-border", className)}>
      {url ? (
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center text-muted-foreground">
          <UserRound className="size-6" />
        </span>
      )}
    </div>
  );
}

function PersonaCard({ p, defaultOpen }: { p: PersonaContent; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(!!defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className={cn("overflow-hidden p-0 transition-colors", open && "border-primary/30")}>
        <CollapsibleTrigger className="flex w-full items-center gap-3 p-4 text-start transition-colors hover:bg-card/60">
          <Avatar url={p.avatar_url} className="size-14" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-heading text-base font-bold text-foreground">{p.name}</span>
              {p.archetype && <Badge variant="cyan">{p.archetype}</Badge>}
            </div>
            {p.summary && (
              <p className={cn("mt-0.5 text-sm text-muted-foreground", !open && "line-clamp-1")}>
                {p.summary}
              </p>
            )}
          </div>
          <ChevronDown
            className={cn(
              "size-5 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="space-y-4 border-t border-border px-4 pb-5 pt-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              {p.age && <span>{p.age}</span>}
              {p.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5" />
                  {p.location}
                </span>
              )}
            </div>

            {p.traits?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {p.traits.map((t, i) => (
                  <span key={i} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                    {t}
                  </span>
                ))}
              </div>
            )}

            {p.quote && (
              <blockquote className="rounded-xl bg-muted/50 p-3 text-sm leading-relaxed text-foreground">
                ״{p.quote}״
              </blockquote>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              {p.goals?.length > 0 && <PersonaList icon={Target} title="מטרות" items={p.goals} accent />}
              {p.pains?.length > 0 && <PersonaList icon={AlertTriangle} title="כאבים וחסמים" items={p.pains} />}
            </div>

            {p.how_we_help && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-primary">
                  <HeartHandshake className="size-4" />
                  איך אנחנו עוזרים
                </p>
                <p className="text-sm leading-relaxed text-foreground/90">{p.how_we_help}</p>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

function PersonaList({
  icon: Icon,
  title,
  items,
  accent,
}: {
  icon: typeof Target;
  title: string;
  items: string[];
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/40 p-3">
      <p
        className={cn(
          "mb-1.5 flex items-center gap-1.5 text-sm font-semibold",
          accent ? "text-primary" : "text-muted-foreground"
        )}
      >
        <Icon className="size-4" />
        {title}
      </p>
      <ul className="space-y-1 text-sm text-muted-foreground">
        {items.map((it, i) => (
          <li key={i} className="flex gap-1.5">
            <span className="mt-1.5 size-1 shrink-0 rounded-full bg-muted-foreground/50" />
            {it}
          </li>
        ))}
      </ul>
    </div>
  );
}
