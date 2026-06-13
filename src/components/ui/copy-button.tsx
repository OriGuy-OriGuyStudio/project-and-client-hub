import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Copy } from "lucide-react";
import type { VariantProps } from "class-variance-authority";
import { buttonVariants } from "@/components/ui/button";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { toast, toastError } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface CopyButtonProps extends VariantProps<typeof buttonVariants> {
  /** The text written to the clipboard. */
  content: string;
  /** Optional label beside the icon. Omit for an icon-only button. */
  label?: string;
  /** Label shown briefly after a successful copy (defaults to "הועתק"). */
  labelCopied?: string;
  /** Toast title on success. Pass `null` to stay silent (e.g. icon-only swatches). */
  toastMessage?: string | null;
  /** Milliseconds before the button resets to its idle state. */
  delay?: number;
  className?: string;
  disabled?: boolean;
  title?: string;
}

/**
 * Brand copy button: copies `content` to the clipboard and morphs its icon from
 * a copy glyph to a check, then back. Built on the shared `buttonVariants` so it
 * inherits the studio's tokens (green accent, soft shadows, RTL spacing).
 * Honours prefers-reduced-motion by swapping the icon without animation.
 */
export function CopyButton({
  content,
  label,
  labelCopied = "הועתק",
  toastMessage = "הועתק ללוח",
  delay = 2000,
  variant = "secondary",
  size,
  className,
  disabled,
  title,
}: CopyButtonProps) {
  const reduced = usePrefersReducedMotion();
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => () => clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      if (toastMessage) toast({ title: toastMessage, variant: "success" });
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), delay);
    } catch {
      toastError("ההעתקה נכשלה.");
    }
  }

  const resolvedSize = size ?? (label ? "default" : "icon");

  return (
    <button
      type="button"
      onClick={copy}
      disabled={disabled}
      title={title ?? (label ? undefined : "העתקה")}
      aria-label={label ?? title ?? "העתקה"}
      className={cn(buttonVariants({ variant, size: resolvedSize }), className)}
    >
      <span className="relative inline-flex size-4 items-center justify-center">
        <AnimatePresence initial={false} mode="popLayout">
          {copied ? (
            <motion.span
              key="check"
              initial={reduced ? false : { scale: 0, opacity: 0, rotate: -45 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={reduced ? undefined : { scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 24 }}
              className="absolute inset-0 flex items-center justify-center text-primary"
            >
              <Check className="size-4" />
            </motion.span>
          ) : (
            <motion.span
              key="copy"
              initial={reduced ? false : { scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={reduced ? undefined : { scale: 0, opacity: 0, rotate: 45 }}
              transition={{ type: "spring", stiffness: 420, damping: 24 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <Copy className="size-4" />
            </motion.span>
          )}
        </AnimatePresence>
      </span>
      {label && (
        <span className="overflow-hidden">
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={copied ? "label-copied" : "label-idle"}
              initial={reduced ? false : { y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={reduced ? undefined : { y: -12, opacity: 0 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
              className="block"
            >
              {copied ? labelCopied : label}
            </motion.span>
          </AnimatePresence>
        </span>
      )}
    </button>
  );
}
