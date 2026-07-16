import { useEffect, useState, type RefObject } from "react";
import { useInView, type UseInViewOptions } from "framer-motion";

/** Wraps framer-motion's `useInView` with a timeout fallback so scroll
 *  reveals on the quote page can never get stuck invisible. Some
 *  environments (throttled in-app webviews, e.g. the one WhatsApp opens
 *  quote links in, or an embedded preview iframe) never fire
 *  IntersectionObserver callbacks at all. This is a signing document ,
 *  content must never be permanently hidden because of that.
 *
 *  Returns true once either the IO reports the element in view, or
 *  `timeoutMs` has elapsed since mount, whichever comes first. In a normal
 *  browser the IO fires well before the timeout, so this is a no-op there ,
 *  the fallback only ever changes behavior when IO was never going to fire
 *  anyway. */
export function useInViewWithFallback(
  ref: RefObject<Element | null>,
  options?: UseInViewOptions,
  timeoutMs = 1200,
): boolean {
  const ioInView = useInView(ref, options);
  const [forced, setForced] = useState(false);

  useEffect(() => {
    if (ioInView) return;
    const timer = window.setTimeout(() => setForced(true), timeoutMs);
    return () => window.clearTimeout(timer);
  }, [ioInView, timeoutMs]);

  return ioInView || forced;
}
