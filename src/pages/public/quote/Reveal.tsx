import { motion, useReducedMotion, type Variants } from "framer-motion";

/** Shared scroll-reveal wrapper for the client quote page. A single subtle
 *  fade+rise, gated on `prefers-reduced-motion` (returns children unmodified,
 *  no motion component at all, when reduced). Every content section on the
 *  page uses this instead of rolling its own animation so the page feels like
 *  one system rather than a pile of one-off effects. */
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
    hidden: { opacity: 0, y: 18 },
    show: { opacity: 1, y: 0, transition: { duration: 0.5, delay, ease: "easeOut" } },
  };
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-60px" }}
      variants={variants}
    >
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
          {intro && <p className="mt-2 text-sm text-muted-foreground">{intro}</p>}
        </div>
        {children}
      </Reveal>
    </section>
  );
}
