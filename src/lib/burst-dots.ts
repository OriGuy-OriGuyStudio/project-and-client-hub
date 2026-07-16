import gsap from "gsap";
import { Physics2DPlugin } from "gsap/Physics2DPlugin";

gsap.registerPlugin(Physics2DPlugin);

/** Brand palette for the click-dot burst , intentionally lighter/softer than
 *  `lib/confetti.ts`'s BRAND array (this effect fires on plain nav/menu
 *  clicks, not a celebration moment, so it stays understated). */
const DOT_COLORS = ["#B4D670", "#d3ec9f", "#8fb84f", "#f2f2f6"];

const MIN_DOT_COUNT = 5;
const MAX_DOT_COUNT = 9;
const MIN_SIZE_PX = 8; // 0.5rem
const MAX_SIZE_PX = 16; // 1rem
const MIN_VELOCITY = 200;
const MAX_VELOCITY = 650;
const GRAVITY = 900;

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function randomBetween(min: number, max: number) {
  return min + Math.random() * (max - min);
}

/**
 * Osmo Supply's "Mouse Cursor Confetti" behavior, rebuilt with gsap instead
 * of their vanilla JS: a small handful of round dots pop from a screen point
 * (x, y in viewport px, e.g. a click's `clientX`/`clientY`) in the brand
 * palette, flung out with randomized velocity/angle, pulled down by gravity,
 * and faded out , then removed from the DOM. Dots are absolutely
 * (`fixed`) positioned, `pointer-events: none`, appended to `document.body`.
 *
 * Uses gsap's `Physics2DPlugin` for the velocity/angle/gravity motion , gsap
 * 3.13+ ships every plugin (including this one) with the core package, no
 * separate install or club membership needed, confirmed present in this
 * project's installed gsap (3.15.0).
 *
 * No-ops entirely under `prefers-reduced-motion`.
 */
export function burstDots(x: number, y: number) {
  if (prefersReducedMotion()) return;
  if (typeof document === "undefined") return;

  const count = Math.round(randomBetween(MIN_DOT_COUNT, MAX_DOT_COUNT));

  for (let i = 0; i < count; i++) {
    const size = randomBetween(MIN_SIZE_PX, MAX_SIZE_PX);
    const color = DOT_COLORS[Math.floor(Math.random() * DOT_COLORS.length)];

    const dot = document.createElement("div");
    dot.setAttribute("aria-hidden", "true");
    Object.assign(dot.style, {
      position: "fixed",
      left: `${x}px`,
      top: `${y}px`,
      width: `${size}px`,
      height: `${size}px`,
      marginInlineStart: `${-size / 2}px`,
      marginTop: `${-size / 2}px`,
      borderRadius: "9999px",
      background: color,
      pointerEvents: "none",
      zIndex: "9999",
      willChange: "transform, opacity",
    } as CSSStyleDeclaration);
    document.body.appendChild(dot);

    const angle = randomBetween(0, 360);
    const velocity = randomBetween(MIN_VELOCITY, MAX_VELOCITY);

    gsap.to(dot, {
      physics2D: { velocity, angle, gravity: GRAVITY },
      opacity: 0,
      duration: randomBetween(0.7, 1.1),
      ease: "power1.out",
      onComplete: () => dot.remove(),
    });
  }
}
