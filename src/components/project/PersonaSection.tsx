import { AlertTriangle, HeartHandshake, MapPin, Target, UserRound, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { usePublishedPersonas } from "@/hooks/useDeliverables";
import type { PersonaContent } from "@/types/database";

/** Client-facing "קהל היעד" section: the published personas for a project.
 *  Hidden when the project has none. */
export function PersonaSection({ projectId }: { projectId: string }) {
  const { data } = usePublishedPersonas(projectId);
  if (!data || data.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <Users className="size-5 text-primary" />
        <h2 className="font-heading text-lg font-bold text-foreground">קהל היעד</h2>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {data.map((d) => (
          <PersonaCard key={d.id} p={d.content as unknown as PersonaContent} />
        ))}
      </div>
    </section>
  );
}

function PersonaCard({ p }: { p: PersonaContent }) {
  return (
    <Card className="space-y-4 p-5">
      <div className="flex items-start gap-3">
        <div className="size-20 shrink-0 overflow-hidden rounded-full bg-muted">
          {p.avatar_url ? (
            <img src={p.avatar_url} alt="" className="size-full object-cover" />
          ) : (
            <span className="flex size-full items-center justify-center text-muted-foreground">
              <UserRound className="size-8" />
            </span>
          )}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-heading text-lg font-bold text-foreground">{p.name}</h3>
            {p.archetype && <Badge variant="cyan">{p.archetype}</Badge>}
          </div>
          {p.summary && <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{p.summary}</p>}
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {p.age && <span>{p.age}</span>}
            {p.location && (
              <span className="flex items-center gap-1">
                <MapPin className="size-3.5" />
                {p.location}
              </span>
            )}
          </div>
          {p.traits?.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {p.traits.map((t, i) => (
                <span key={i} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

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
    </Card>
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
