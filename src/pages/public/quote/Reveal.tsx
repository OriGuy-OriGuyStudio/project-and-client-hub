import { useRef } from "react";
import { motion, useReducedMotion, type Variants } from "framer-motion";
import { useInViewWithFallback } from "./useInViewFallback";

/** Shared viewport config for every scroll-reveal on this page, once each
 *  element's own animation has run, it stays put (no re-triggering on scroll
 *  back up), and it fires a little before the element is actually on screen
 *  so nothing feels like it's popping in late. */
const REVEAL_VIEWPORT = { once: true, margin: "-80px" } as const;

/** If IntersectionObserver never fires (some webviews, embedded previews),
 *  force every reveal visible after this long rather than leave it stuck
 *  hidden , this is a signing document. */
const FALLBACK_TIMEOUT_MS = 1200;

/** Shared scroll-reveal wrapper for the client quote page. A single subtle
 *  fade+rise, gated on `prefers-reduced-motion` (returns children unmodified,
 *  no motion component at all, when reduced, so content is never stuck
 *  invisible , the "hidden" opacity only ever exists as a framer-motion
 *  variant, never as a CSS class, so it can't get stuck if JS misbehaves).
 *  Uses `useInViewWithFallback` instead of `whileInView` so the reveal is
 *  also never stuck hidden when IO callbacks never fire. Every content
 *  section on the page uses this instead of rolling its own animation so
 *  the page feels like one system rather than a pile of one-off effects. */
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
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInViewWithFallback(ref, REVEAL_VIEWPORT, FALLBACK_TIMEOUT_MS);

  if (reduce) return <div className={className}>{children}</div>;

  const variants: Variants = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, delay, ease: "easeOut" } },
  };
  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
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
 *  fully-visible div, no motion component at all. Also uses
 *  `useInViewWithFallback` so the cascade always runs even if IO never
 *  fires. */
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
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInViewWithFallback(ref, REVEAL_VIEWPORT, FALLBACK_TIMEOUT_MS);

  if (reduce) return <div className={className}>{children}</div>;

  const variants: Variants = {
    hidden: {},
    show: { transition: { staggerChildren: staggerDelay } },
  };
  return (
    <motion.div
      ref={ref}
      className={className}
      initial="hidden"
      animate={inView ? "show" : "hidden"}
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
    <section id={id} className="scroll-mt-24 py-16 sm:py-24">
      <Reveal>
        <div className="mb-8 text-center sm:mb-10">
          <h2 className="font-heading text-3xl font-black sm:text-4xl">{title}</h2>
          {intro && <p className="mt-3 text-base text-muted-foreground sm:text-lg">{intro}</p>}
        </div>
        {children}
      </Reveal>
    </section>
  );
}
