import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { clientTourSteps, partnerTourSteps, type TourStep } from "./help-content";

/** First element matching the selector that's actually visible on screen. */
function firstVisible(selector: string): HTMLElement | null {
  const els = [...document.querySelectorAll<HTMLElement>(selector)];
  return els.find((el) => el.offsetParent !== null) ?? null;
}

/**
 * Runs an orientation tour over whichever target elements are visible.
 * Pass `sinceExclusive` to run a "what's new" delta — only steps whose `since`
 * is greater than the version the user last saw.
 */
function runTour(tourSteps: TourStep[], sinceExclusive = 0) {
  const steps = tourSteps
    .filter((s) => (s.since ?? 1) > sinceExclusive)
    .map((s) => {
      const el = firstVisible(s.selector);
      return el
        ? { element: el, popover: { title: s.title, description: s.description } }
        : null;
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);
  if (!steps.length) return;

  driver({
    showProgress: true,
    allowClose: true,
    nextBtnText: "הבא",
    prevBtnText: "הקודם",
    doneBtnText: "סיום",
    progressText: "{{current}} מתוך {{total}}",
    steps,
  }).drive();
}

/** `since`: when set, runs only the steps newer than that version (delta tour). */
export function startClientTour(opts?: { since?: number }) {
  runTour(clientTourSteps, opts?.since ?? 0);
}

export function startPartnerTour(opts?: { since?: number }) {
  runTour(partnerTourSteps, opts?.since ?? 0);
}
