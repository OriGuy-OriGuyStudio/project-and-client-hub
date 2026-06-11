import confetti from "canvas-confetti";

const BRAND = ["#B4D670", "#91BE37", "#77BECF", "#543EE0", "#F4527E"];

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
