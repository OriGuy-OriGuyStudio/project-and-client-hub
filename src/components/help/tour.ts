import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import { clientTourSteps, partnerTourSteps, type TourStep } from "./help-content";

/** First element matching the selector that's actually visible on screen. */
function firstVisible(selector: string): HTMLElement | null {
  const els = [...document.querySelectorAll<HTMLElement>(selector)];
  return els.find((el) => el.offsetParent !== null) ?? null;
}

/** Runs an orientation tour over whichever target elements are visible. */
function runTour(tourSteps: TourStep[]) {
  const steps = tourSteps
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

export function startClientTour() {
  runTour(clientTourSteps);
}

export function startPartnerTour() {
  runTour(partnerTourSteps);
}
