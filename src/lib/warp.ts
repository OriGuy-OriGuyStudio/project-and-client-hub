/**
 * Tiny emitter for the "warp" easter egg: clicking the Orion wordmark in the
 * footer asks the WarpOverlay (mounted in the authenticated shell) to launch the
 * hyperspace sequence. Keeps the trigger decoupled from the overlay.
 */
const listeners = new Set<() => void>();

/** Fire the warp (no-op if nothing is listening, e.g. on the login screen). */
export function requestWarp() {
  listeners.forEach((l) => l());
}

/** Subscribe the overlay to warp requests. Returns an unsubscribe. */
export function onWarp(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
