import { motion, useReducedMotion, type Variants } from "framer-motion";
import { AppWindow, Lightbulb, MapPin, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { usePublishedJourney } from "@/hooks/useDeliverables";
import type { JourneyContent, JourneyStage } from "@/types/database";

/** Classify a stage's emotion into a sentiment, to colour the emotional arc. */
function tone(emotion: string): "pos" | "neg" | "neu" {
  const e = emotion || "";
  const neg = ["חושש", "חשש", "מהסס", "מתוסכל", "תסכול", "אכזב", "אשמה", "לחוץ", "מודאג", "מבולבל", "ספקן", "עייף", "כועס", "דחיפות", "חוסר"];
  const pos = ["מרוצה", "שמח", "בטוח", "רגוע", "נלהב", "סקרן", "גאה", "הקלה", "אופטימי", "מסופק", "נאמן", "התלהב"];
  if (neg.some((w) => e.includes(w))) return "neg";
  if (pos.some((w) => e.includes(w))) return "pos";
  return "neu";
}

const TONE_PILL: Record<string, string> = {
  pos: "border-primary/30 bg-primary/10 text-primary",
  neg: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  neu: "border-border bg-muted text-muted-foreground",
};

/** Client-facing customer-journey map, rendered as a live vertical timeline
 *  (spine + numbered nodes) with a staggered scroll reveal and an emotional-arc
 *  colour per stage. The "מסע לקוח" tab body of the site-blueprint panel; null
 *  when there is no published journey. */
export function JourneyBody({ projectId }: { projectId: string }) {
  const { data } = usePublishedJourney(projectId);
  const reduce = useReducedMotion();
  if (!data) return null;
  const journey = data.content as unknown as JourneyContent;
  if (!journey.stages?.length) return null;

  const container: Variants = reduce
    ? {}
    : { hidden: {}, show: { transition: { staggerChildren: 0.12 } } };
  const item: Variants = reduce
    ? {}
    : {
        hidden: { opacity: 0, y: 22 },
        show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 100, damping: 20 } },
      };

  return (
    <motion.ol
      className="relative"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      variants={container}
    >
      {/* the spine, aligned to the node centres (inline-start) */}
      <div
        aria-hidden
        className="absolute bottom-8 top-6 w-px bg-gradient-to-b from-primary/50 via-primary/25 to-transparent"
        style={{ insetInlineStart: "17px" }}
      />

      {journey.stages.map((s, i) => (
        <motion.li key={i} variants={item} className="relative mb-4 ps-12 last:mb-0">
          <span className="absolute start-0 top-4 z-10 flex size-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground ring-4 ring-background">
            {i + 1}
          </span>
          <StageCard s={s} />
        </motion.li>
      ))}
    </motion.ol>
  );
}

function BlockLabel({
  icon: Icon,
  title,
  className,
}: {
  icon: typeof MapPin;
  title: string;
  className?: string;
}) {
  return (
    <p className={cn("mb-1.5 flex items-center gap-1.5 text-xs font-semibold", className ?? "text-muted-foreground")}>
      <Icon className="size-3.5" />
      {title}
    </p>
  );
}

function StageCard({ s }: { s: JourneyStage }) {
  return (
    <Card className="space-y-3 p-4 transition-transform hover:-translate-y-0.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-heading text-base font-semibold text-foreground">{s.name}</h3>
        {s.emotion && (
          <span className={cn("rounded-full border px-2.5 py-0.5 text-xs", TONE_PILL[tone(s.emotion)])}>
            {s.emotion}
          </span>
        )}
      </div>

      {s.goal && <p className="text-sm leading-relaxed text-foreground/90">{s.goal}</p>}

      {s.touchpoints?.length > 0 && (
        <div>
          <BlockLabel icon={MapPin} title="נקודות מגע" />
          <div className="flex flex-wrap gap-1.5">
            {s.touchpoints.map((t, i) => (
              <span key={i} className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                {t}
              </span>
            ))}
          </div>
        </div>
      )}

      {s.pains?.length > 0 && (
        <div>
          <BlockLabel icon={AlertTriangle} title="כאבים וחסמים" className="text-amber-400" />
          <ul className="space-y-1 text-sm text-muted-foreground">
            {s.pains.map((p, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-amber-400/70" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {s.on_site?.trim() && (
        <div className="rounded-xl border border-brand-cyan-base/25 bg-brand-cyan-base/5 p-3">
          <BlockLabel icon={AppWindow} title="באתר" className="text-brand-cyan-base" />
          <p className="text-sm leading-relaxed text-foreground/90">{s.on_site}</p>
        </div>
      )}

      {s.actions?.length > 0 && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
          <BlockLabel icon={Lightbulb} title="מה אני עושה" className="text-primary" />
          <ul className="space-y-1 text-sm text-foreground/90">
            {s.actions.map((a, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="mt-1.5 size-1 shrink-0 rounded-full bg-primary/60" />
                {a}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
