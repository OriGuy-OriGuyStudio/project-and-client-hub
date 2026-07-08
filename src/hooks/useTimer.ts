import { useSyncExternalStore } from "react";
import { timer } from "@/lib/timer-store";

/** Subscribe a component to the singleton timer store's configuration state. */
export function useTimer() {
  return useSyncExternalStore(timer.subscribe, timer.getSnapshot, timer.getSnapshot);
}
