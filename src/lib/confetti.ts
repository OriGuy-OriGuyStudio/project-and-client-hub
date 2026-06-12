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
