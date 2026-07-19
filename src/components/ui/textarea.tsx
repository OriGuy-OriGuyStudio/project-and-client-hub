import * as React from "react";
import { cn } from "@/lib/utils";

type TextareaProps = React.ComponentProps<"textarea"> & {
  /** Grows with the content instead of scrolling inside a fixed box, so long
   *  document text stays fully visible while it's being arranged. `rows` (or
   *  a min-height class) still sets the starting size. Opt-in, because a few
   *  places (chat composer, doc editors) deliberately keep a fixed box. */
  autoGrow?: boolean;
};

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, autoGrow, onChange, ...props }, ref) => {
    const innerRef = React.useRef<HTMLTextAreaElement | null>(null);

    // Keep the caller's ref working while we also hold our own.
    const setRefs = React.useCallback(
      (node: HTMLTextAreaElement | null) => {
        innerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current = node;
      },
      [ref]
    );

    const resize = React.useCallback(() => {
      const el = innerRef.current;
      if (!el || !autoGrow) return;
      // Collapse first, otherwise scrollHeight can only ever grow.
      el.style.height = "auto";
      el.style.height = `${el.scrollHeight}px`;
    }, [autoGrow]);

    // Fit on mount and whenever the value changes from outside (an AI assist
    // fills the field, a different item is loaded into the same input...).
    React.useLayoutEffect(() => {
      resize();
    }, [resize, props.value]);

    return (
      <textarea
        ref={setRefs}
        onChange={(e) => {
          onChange?.(e);
          resize();
        }}
        className={cn(
          "flex min-h-20 w-full rounded-xl border border-input bg-field px-3.5 py-2.5 text-sm leading-relaxed text-foreground transition-colors duration-200 ease-soft placeholder:text-muted-foreground/60 hover:border-input/80 focus-visible:border-ring/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
          // No inner scrollbar when the box itself follows the text.
          autoGrow && "resize-none overflow-hidden",
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
