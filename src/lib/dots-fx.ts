/**
 * Tiny emitter so a UI control (the playful "disco" button on the login screen)
 * can ask the DotsGrid background to replay its random twinkle on demand. Keeps
 * the button decoupled from the grid's internals.
 */
const listeners = new Set<() => void>();

/** Ask the dots grid to play the disco twinkle now. */
export function requestDotsDisco() {
  listeners.forEach((l) => l());
}

/** Subscribe the grid to disco requests. Returns an unsubscribe. */
export function onDotsDisco(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
