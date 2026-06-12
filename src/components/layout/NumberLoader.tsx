import { useEffect, useRef } from "react";
import gsap from "gsap";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const REEL = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

/**
 * Brand-themed number preloader, adapted from Osmo Supply's "Number Loader in
 * 3 Steps" (GSAP odometer). Counts up in steps to 100%, then slides away and
 * calls `onDone`. Animation approach (GSAP timeline) preserved from the source.
 */
export function NumberLoader({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = root.current;
    if (!el) return;

    // No scope - there is a single loader instance, so global selectors resolve
    // every descendant target. The root itself (.loading-container) is animated
    // via the captured element, not a selector.
    const ctx = gsap.context(() => {
      // Reduced motion: snap to the finished frame, hold briefly, then leave.
      if (reduced) {
        gsap.set(".loading-screen", { display: "block" });
        gsap.set(".loading__progress-inner", { scaleY: 1 });
        gsap.set(".loading__percentage", { yPercent: 0 });
        gsap.set(".loading__number-group.is--first .loading__number-wrap", { yPercent: 0 });
        gsap.set(
          ".loading__number-group.is--second .loading__number-wrap, .loading__number-group.is--third .loading__number-wrap",
          { yPercent: -90 }
        );
        gsap.delayedCall(0.5, onDone);
        return;
      }

      const tl = gsap.timeline();
      gsap.defaults({ ease: "expo.inOut", duration: 1.2 });

      const r1 = gsap.utils.random([2, 3, 4]);
      const r2 = gsap.utils.random([5, 6]);
      const r3 = gsap.utils.random([1, 5]);
      const r4 = gsap.utils.random([7, 8, 9]);

      tl.set(".loading-screen", { display: "block" });
      tl.set(".loading__progress-inner", { scaleY: 0 });
      tl.set(
        ".loading__number-group.is--first .loading__number-wrap, .loading__percentage",
        { yPercent: 100 }
      );
      tl.set(
        ".loading__number-group.is--second .loading__number-wrap, .loading__number-group.is--third .loading__number-wrap",
        { yPercent: 10 }
      );

      tl.to(".loading__progress-inner", { scaleY: Number(r1 + "" + r3) / 100 });
      tl.to(".loading__percentage", { yPercent: 0 }, "<");
      tl.to(".loading__number-group.is--second .loading__number-wrap", { yPercent: (r1 - 1) * -10 }, "<");
      tl.to(".loading__number-group.is--third .loading__number-wrap", { yPercent: (r3 - 1) * -10 }, "<");

      tl.to(".loading__progress-inner", { scaleY: Number(r2 + "" + r4) / 100 });
      tl.to(".loading__number-group.is--second .loading__number-wrap", { yPercent: (r2 - 1) * -10 }, "<");
      tl.to(".loading__number-group.is--third .loading__number-wrap", { yPercent: (r4 - 1) * -10 }, "<");

      tl.to(".loading__progress-inner", { scaleY: 1 });
      tl.to(".loading__number-group.is--second .loading__number-wrap", { yPercent: -90 }, "<");
      tl.to(".loading__number-group.is--third .loading__number-wrap", { yPercent: -90 }, "<");
      tl.to(".loading__number-group.is--first .loading__number-wrap", { yPercent: 0 }, "<");

      // Exit - slide the whole curtain up, then hand control back to the app.
      tl.to(el, { yPercent: -100, duration: 0.9, ease: "expo.inOut" }, "+=0.35");
      tl.call(() => onDone());
    });

    return () => ctx.revert();
    // onDone is stable (set once by IntroLoader); intentionally run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={root} className="loading-container">
      <div className="loading-screen">
        <div className="loading__progress">
          <div className="loading__progress-inner" />
        </div>
        <div className="loading__numbers">
          <div className="loading__number-group is--first">
            <div className="loading__number-wrap">
              <span className="loading__number">1</span>
            </div>
          </div>
          <div className="loading__number-group is--second">
            <div className="loading__number-wrap">
              {REEL.map((n, i) => (
                <span key={i} className="loading__number">{n}</span>
              ))}
            </div>
          </div>
          <div className="loading__number-group is--third">
            <div className="loading__number-wrap">
              {REEL.map((n, i) => (
                <span key={i} className="loading__number">{n}</span>
              ))}
            </div>
          </div>
          <div className="loading__percentage-wrap">
            <span className="loading__percentage">%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
