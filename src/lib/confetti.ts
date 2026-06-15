import confetti from "canvas-confetti";

const BRAND = ["#B4D670", "#91BE37", "#77BECF", "#543EE0", "#F4527E"];

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * A firework-style radial spark bursting from a screen point (x, y in px) —
 * the "juice" on the disco button. Fires a punchy burst, then a smaller echo.
 */
export function sparkBurst(x: number, y: number) {
  if (prefersReducedMotion()) return;
  const origin = { x: x / window.innerWidth, y: y / window.innerHeight };
  confetti({
    particleCount: 48,
    spread: 360,
    startVelocity: 30,
    gravity: 0.7,
    decay: 0.9,
    scalar: 0.85,
    ticks: 90,
    origin,
    colors: BRAND,
    zIndex: 9998,
  });
  window.setTimeout(() => {
    confetti({
      particleCount: 24,
      spread: 360,
      startVelocity: 16,
      gravity: 0.6,
      scalar: 0.7,
      ticks: 70,
      origin,
      colors: BRAND,
      zIndex: 9998,
    });
  }, 140);
}

/**
 * A grander celebration for a "featured" reward redemption — a 1.8s show of
 * star bursts raining from the top plus side cannons. Respects reduced-motion.
 */
export function celebrateBig() {
  if (prefersReducedMotion()) return;
  const end = Date.now() + 1800;
  const star = { shapes: ["star"] as ("star" | "circle")[], colors: BRAND };
  // Opening double cannon.
  confetti({ particleCount: 120, spread: 90, startVelocity: 55, origin: { x: 0.5, y: 0.6 }, colors: BRAND, zIndex: 9998 });
  (function frame() {
    confetti({ ...star, particleCount: 6, angle: 60, spread: 70, startVelocity: 60, origin: { x: 0, y: 0.65 }, zIndex: 9998 });
    confetti({ ...star, particleCount: 6, angle: 120, spread: 70, startVelocity: 60, origin: { x: 1, y: 0.65 }, zIndex: 9998 });
    confetti({ ...star, particleCount: 4, spread: 360, startVelocity: 25, gravity: 0.8, origin: { x: Math.random(), y: -0.1 }, zIndex: 9998 });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

/** Celebratory confetti bursting in from both sides. Respects reduced-motion. */
export function celebrate() {
  if (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    return;
  }
  const end = Date.now() + 700;
  (function frame() {
    confetti({
      particleCount: 5,
      angle: 60,
      spread: 60,
      startVelocity: 55,
      origin: { x: 0, y: 0.7 },
      colors: BRAND,
      zIndex: 9998,
    });
    confetti({
      particleCount: 5,
      angle: 120,
      spread: 60,
      startVelocity: 55,
      origin: { x: 1, y: 0.7 },
      colors: BRAND,
      zIndex: 9998,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}
