import { Moon, Sun } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useTheme } from "@/hooks/useTheme";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

/**
 * Theme switch styled as a pill with an animated sun/moon swap. The label names
 * the mode you'll switch *to*, in plain Hebrew ("מצב כהה" / "מצב בהיר") so it's
 * clear to non-technical users — no "dark/light mode" jargon. Text collapses to
 * icon-only on small screens to keep the header tight.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const reduced = usePrefersReducedMotion();
  const isDark = theme === "dark";

  // The action this button performs (current mode is the opposite).
  const label = isDark ? "מצב בהיר" : "מצב כהה";
  const Icon = isDark ? Sun : Moon;

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-full border border-border bg-secondary px-2 text-sm text-foreground transition-colors hover:border-primary/50 sm:px-3",
        className
      )}
    >
      <span className="relative flex size-5 items-center justify-center">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={isDark ? "sun" : "moon"}
            initial={reduced ? false : { rotate: -90, scale: 0.4, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            exit={reduced ? { opacity: 0 } : { rotate: 90, scale: 0.4, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.35, 1.2, 0.6, 1] }}
            className="absolute flex items-center justify-center"
          >
            <Icon className="size-5" />
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="hidden whitespace-nowrap sm:inline">{label}</span>
    </button>
  );
}
