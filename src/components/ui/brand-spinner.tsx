import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Branded loading indicator - a green arc orbiting the studio mark.
 * The "big loading icon" for data fetches and full-screen waits.
 */
export function BrandSpinner({
  size = 48,
  label,
  className,
}: {
  size?: number;
  label?: string;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const ring = Math.max(2, Math.round(size / 16));

  return (
    <div className={cn("flex flex-col items-center gap-3", className)}>
      <div className="relative" style={{ width: size, height: size }}>
        {/* Track */}
        <div
          className="absolute inset-0 rounded-full border-primary/15"
          style={{ borderWidth: ring }}
        />
        {/* Spinning arc */}
        <motion.div
          className="absolute inset-0 rounded-full border-transparent border-t-primary"
          style={{ borderWidth: ring }}
          animate={reduce ? undefined : { rotate: 360 }}
          transition={{ duration: 0.9, ease: "linear", repeat: Infinity }}
        />
        {/* Soft breathing glow behind the mark */}
        <motion.div
          className="absolute inset-[18%] rounded-full bg-primary/15 blur-md"
          animate={reduce ? undefined : { opacity: [0.35, 0.7, 0.35], scale: [0.92, 1.04, 0.92] }}
          transition={{ duration: 1.8, ease: "easeInOut", repeat: Infinity }}
        />
        <img
          src="/brand/logo-mark.svg"
          alt=""
          aria-hidden
          className="absolute inset-0 m-auto"
          style={{ width: size * 0.46, height: size * 0.46 }}
        />
      </div>
      {label && (
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
      )}
    </div>
  );
}

/** Centered in-page loader for data fetches - keeps the view from sitting empty. */
export function CenteredLoader({ label = "טוען…" }: { label?: string }) {
  return (
    <div className="flex min-h-[40vh] w-full items-center justify-center">
      <BrandSpinner size={56} label={label} />
    </div>
  );
}
