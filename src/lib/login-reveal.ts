/**
 * Tiny one-shot signal: "the login screen is now visible" (the welcoming-words
 * curtain has finished, or never played). The DotsGrid waits for this before
 * running its intro sweep, so the sweep plays when the screen is actually
 * revealed — not hidden behind the curtain. Module-scoped, so it resets on a
 * full page load and survives SPA navigation between login screens.
 */
let revealed = false;
const listeners = new Set<() => void>();

/** Fire the signal (idempotent). */
export function markLoginRevealed() {
  if (revealed) return;
  revealed = true;
  listeners.forEach((l) => l());
  listeners.clear();
}

/** Run `cb` when the login screen is revealed — immediately if already. Returns
 *  an unsubscribe for the not-yet-revealed case. */
export function onLoginRevealed(cb: () => void): () => void {
  if (revealed) {
    cb();
    return () => {};
  }
  listeners.add(cb);
  return () => listeners.delete(cb);
}
