import { motion, useReducedMotion, type Variants } from "framer-motion";

/** Shared viewport config for every scroll-reveal on this page, once each
 *  element's own animation has run, it stays put (no re-triggering on scroll
 *  back up), and it fires a little before the element is actually on screen
 *  so nothing feels like it's popping in late. */
const REVEAL_VIEWPORT = { once: true, margin: "-80px" } as const;

/** Shared scroll-reveal wrapper for the client quote page. A single subtle
 *  fade+rise, gated on `prefers-reduced-motion` (returns children unmodified,
 *  no motion component at all, when reduced, so content is never stuck
 *  invisible , the "hidden" opacity only ever exists as a framer-motion
 *  variant, never as a CSS class, so it can't get stuck if JS misbehaves).
 *  Every content section on the page uses this instead of rolling its own
 *  animation so the page feels like one system rather than a pile of
 *  one-off effects. */
export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;

  const variants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, delay, ease: "easeOut" } },
  };
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={REVEAL_VIEWPORT}
      variants={variants}
    >
      {children}
    </motion.div>
  );
}

/** Stagger container for a grid/list of cards (differentiators, bonuses,
 *  extras…): triggers once on scroll-into-view, then cascades its
 *  `RevealItem` children in with a slight delay between each. Gated on
 *  `prefers-reduced-motion` the same way as `Reveal` , renders a plain,
 *  fully-visible div, no motion component at all. */
export function RevealStagger({
  children,
  className,
  staggerDelay = 0.08,
}: {
  children: React.ReactNode;
  className?: string;
  staggerDelay?: number;
}) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;

  const variants: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: staggerDelay } },
  };
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={REVEAL_VIEWPORT}
      variants={variants}
    >
      {children}
    </motion.div>
  );
}

/** One card inside a `RevealStagger` grid. Inherits its `hidden`/`show`
 *  trigger from the parent's variants propagation , no own `whileInView`,
 *  so the cascade is driven entirely by the parent's `staggerChildren`.
 *  Must be a direct motion child of `RevealStagger` to pick up the variant. */
export function RevealItem({ children, className }: { children: React.ReactNode; className?: string }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;

  const variants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: "easeOut" } },
  };
  return (
    <motion.div className={className} variants={variants}>
      {children}
    </motion.div>
  );
}

/** A titled section wrapper: consistent heading style + scroll-margin so the
 *  sticky mini-nav's anchor links land below the nav bar, not under it. */
export function QuoteSection({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 py-10 sm:py-14">
      <Reveal>
        <div className="mb-6 text-center">
          <h2 className="font-heading text-2xl font-black sm:text-3xl">{title}</h2>
          {intro && <p className="mt-2 text-base text-muted-foreground">{intro}</p>}
        </div>
        {children}
      </Reveal>
    </section>
  );
}
