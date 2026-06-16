import { driver } from "driver.js";
import "driver.js/dist/driver.css";
import {
  clientTourSteps,
  clientStoreTourSteps,
  partnerTourSteps,
  type TourStep,
} from "./help-content";

/** First element matching the selector that's actually visible on screen. */
function firstVisible(selector: string): HTMLElement | null {
  const els = [...document.querySelectorAll<HTMLElement>(selector)];
  return els.find((el) => el.offsetParent !== null) ?? null;
}

/** Runs the full orientation tour over whichever target elements are visible. */
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

/** Tour for the client rewards-store page (runs on first visit to that page). */
export function startClientStoreTour() {
  runTour(clientStoreTourSteps);
}

/**
 * Spotlight a single element (used by the help panel: click a "what each part
 * does" item → highlight where it is on the current screen). Returns false if
 * the element isn't on the current page so the caller can hint about that.
 */
export function spotlightStep(selector: string, title: string, description: string): boolean {
  const el = firstVisible(selector);
  if (!el) return false;
  driver({ allowClose: true, doneBtnText: "סגירה" }).highlight({
    element: el,
    popover: { title, description },
  });
  return true;
}

/**
 * Wait until it's safe to interrupt the user — the post-login loader has cleared
 * and no modal/dialog is open (e.g. the gift / redemption-approved popup) — then
 * run `cb`. Polls, gives up after `maxWait` (so a stuck dialog won't block forever).
 * Returns a canceller for effect cleanup.
 */
export function whenUiIsClear(
  cb: () => void,
  opts?: { minDelay?: number; maxWait?: number }
): () => void {
  const minDelay = opts?.minDelay ?? 2400;
  const maxWait = opts?.maxWait ?? 12000;
  let cancelled = false;
  const start = Date.now();
  const tick = () => {
    if (cancelled) return;
    const blocked =
      document.readyState !== "complete" || !!document.querySelector('[role="dialog"]');
    if (!blocked) return cb();
    if (Date.now() - start < maxWait) window.setTimeout(tick, 500);
  };
  const first = window.setTimeout(tick, minDelay);
  return () => {
    cancelled = true;
    window.clearTimeout(first);
  };
}
