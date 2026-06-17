import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

interface HeroPillProps {
  /** Short label shown after the badge. */
  label: string;
  /** Small tag inside the pill (e.g. "✨ חדש"). */
  announcement?: string;
  className?: string;
  /** Render as a link. */
  href?: string;
  isExternal?: boolean;
  /** Render as a button (takes precedence over href). */
  onClick?: () => void;
}

/**
 * Animated announcement pill (adapted from 21st.dev / Codehagen for the brand
 * tokens + RTL). The chevron points to the inline-start (left in RTL) so it
 * reads as "more this way". Renders as a <button> when `onClick` is given,
 * otherwise as an <a>.
 */
export function HeroPill({
  label,
  announcement = "✨ חדש",
  className,
  href,
  isExternal = false,
  onClick,
}: HeroPillProps) {
  const reduce = usePrefersReducedMotion();

  const content = (
    <>
      <span
        className={cn(
          "w-fit rounded-full bg-primary px-2 py-0.5 text-center",
          "text-xs font-semibold text-primary-foreground sm:text-sm"
        )}
      >
        {announcement}
      </span>
      <span className="text-xs font-medium text-foreground sm:text-sm">{label}</span>
      <svg
        width="12"
        height="12"
        className="shrink-0 -scale-x-100 text-primary"
        viewBox="0 0 12 12"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M8.78141 5.33312L5.20541 1.75712L6.14808 0.814453L11.3334 5.99979L6.14808 11.1851L5.20541 10.2425L8.78141 6.66645H0.666748V5.33312H8.78141Z"
          fill="currentColor"
        />
      </svg>
    </>
  );

  const baseClass = cn(
    "flex w-auto items-center gap-2 rounded-full whitespace-pre",
    "border border-primary/30 bg-primary/10 px-2 py-1",
    "transition-colors hover:bg-primary/15",
    className
  );

  const motionProps = reduce
    ? {}
    : {
        initial: { opacity: 0, y: -12 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.6, ease: "easeOut" as const },
      };

  if (onClick) {
    return (
      <motion.button type="button" onClick={onClick} className={baseClass} {...motionProps}>
        {content}
      </motion.button>
    );
  }

  return (
    <motion.a
      href={href}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noopener noreferrer" : undefined}
      className={baseClass}
      {...motionProps}
    >
      {content}
    </motion.a>
  );
}
