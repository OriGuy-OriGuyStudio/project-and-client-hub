// Lightweight toast store (shadcn pattern, trimmed). Hebrew-friendly.
import * as React from "react";
import type { ToastProps } from "@/components/ui/toast";

type ToasterToast = ToastProps & {
  id: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
};

const TOAST_LIMIT = 4;
const TOAST_REMOVE_DELAY = 5000;

let count = 0;
function genId() {
  count = (count + 1) % Number.MAX_SAFE_INTEGER;
  return count.toString();
}

type State = { toasts: ToasterToast[] };
const listeners: Array<(state: State) => void> = [];
let memoryState: State = { toasts: [] };

const timeouts = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleRemoval(id: string) {
  if (timeouts.has(id)) return;
  const t = setTimeout(() => {
    timeouts.delete(id);
    memoryState = { toasts: memoryState.toasts.filter((x) => x.id !== id) };
    listeners.forEach((l) => l(memoryState));
  }, TOAST_REMOVE_DELAY);
  timeouts.set(id, t);
}

function setState(next: State) {
  memoryState = next;
  listeners.forEach((l) => l(memoryState));
}

export function toast(props: Omit<ToasterToast, "id">) {
  const id = genId();
  const dismiss = () =>
    setState({
      toasts: memoryState.toasts.map((t) =>
        t.id === id ? { ...t, open: false } : t
      ),
    });

  setState({
    toasts: [
      {
        ...props,
        id,
        open: true,
        onOpenChange: (open: boolean) => {
          if (!open) {
            dismiss();
            scheduleRemoval(id);
          }
        },
      },
      ...memoryState.toasts,
    ].slice(0, TOAST_LIMIT),
  });

  scheduleRemoval(id);
  return { id, dismiss };
}

/** Convenience for Supabase / runtime errors -> Hebrew destructive toast. */
export function toastError(description: string, title = "שגיאה") {
  return toast({ title, description, variant: "destructive" });
}

export function useToast() {
  const [state, setLocal] = React.useState<State>(memoryState);
  React.useEffect(() => {
    listeners.push(setLocal);
    return () => {
      const i = listeners.indexOf(setLocal);
      if (i > -1) listeners.splice(i, 1);
    };
  }, []);
  return { ...state, toast };
}
