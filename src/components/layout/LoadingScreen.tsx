import { motion, useReducedMotion } from "framer-motion";
import { BrandSpinner } from "@/components/ui/brand-spinner";

/** Full-screen branded loading state shown during auth / initial data resolution. */
export function LoadingScreen() {
  const reduce = useReducedMotion();

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center gap-7 overflow-hidden bg-background">
      {/* Soft brand aura */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 size-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl"
      />

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 10, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative flex flex-col items-center gap-5"
      >
        <BrandSpinner size={72} />

        <div className="flex flex-col items-center gap-1.5">
          <span className="font-heading text-2xl font-bold tracking-tight text-foreground">
            Ori Guy Studio
          </span>
          <span className="text-sm text-muted-foreground">טוען את הפורטל שלך…</span>
        </div>
      </motion.div>

      {/* Thin indeterminate progress shimmer */}
      <div className="relative h-1 w-48 overflow-hidden rounded-full bg-muted">
        <motion.div
          className="absolute inset-y-0 w-1/3 rounded-full bg-primary"
          animate={reduce ? { x: 0 } : { x: ["-110%", "330%"] }}
          transition={{ duration: 1.3, ease: "easeInOut", repeat: Infinity }}
        />
      </div>

      <span className="sr-only">טוען…</span>
    </div>
  );
}
