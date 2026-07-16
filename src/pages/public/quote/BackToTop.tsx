import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUp } from "lucide-react";

/** Fraction of the viewport height the page must be scrolled past before the
 *  button appears (Osmo's back-to-top behavior). */
const SHOW_AFTER_VH_FRACTION = 0.5;

const BUTTON_CLASS =
  "fixed bottom-24 end-4 z-40 grid size-12 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:bottom-6";

/** Fixed round back-to-top button (Osmo Supply behavior, brand-adapted):
 *  hidden until the page is scrolled past half a viewport height, then
 *  fades/scales in. Sits at `bottom-24` on mobile (clearing PricingSection's
 *  fixed sticky price bar) and `bottom-6` from `sm:` up, always on the
 *  inline-end side (`end-4`, right in this RTL page). Instant show/hide and
 *  an instant (non-smooth) scroll under `prefers-reduced-motion`. */
export function BackToTop() {
  const [visible, setVisible] = useState(false);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > window.innerHeight * SHOW_AFTER_VH_FRACTION);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  function scrollToTop() {
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  if (reduceMotion) {
    if (!visible) return null;
    return (
      <button type="button" onClick={scrollToTop} aria-label="חזרה לראש העמוד" className={BUTTON_CLASS}>
        <ArrowUp aria-hidden="true" className="size-5" />
      </button>
    );
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          onClick={scrollToTop}
          aria-label="חזרה לראש העמוד"
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.7 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className={BUTTON_CLASS}
        >
          <ArrowUp aria-hidden="true" className="size-5" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}
