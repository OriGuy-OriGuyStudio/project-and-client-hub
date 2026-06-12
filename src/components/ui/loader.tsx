import { ReactNode, useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface LoaderProps {
  children?: ReactNode;
  className?: string;
  variant?: "default" | "cube" | "dual-ring" | "magnetic-dots";
  size?: number;
}

/**
 * Minimal motion loader (adapted from ScrollX-UI), brand-green instead of
 * black/white and using framer-motion's `motion`.
 */
export function Loader({
  children,
  className = "",
  variant = "default",
  size,
}: LoaderProps) {
  const finalSize = useMemo(() => size ?? 24, [size]);

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div
        className="relative flex items-center justify-center"
        style={{ height: finalSize, width: finalSize }}
      >
        {variant === "default" && (
          <>
            <div className="absolute inset-0 rounded-full border-b-[1.5px] border-t-[1.5px] border-primary/25" />
            <motion.div
              className="absolute inset-0 rounded-full border-b-[1.5px] border-t-[1.5px] border-primary"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            />
          </>
        )}

        {variant === "cube" && (
          <motion.div
            className="absolute inset-0 bg-primary"
            animate={{ rotateX: [0, 180, 0], rotateY: [0, 180, 0] }}
            transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}
          />
        )}

        {variant === "dual-ring" && (
          <>
            <div className="absolute inset-0 rounded-full border-[1.5px] border-primary/20" />
            <motion.div
              className="absolute inset-0 rounded-full border-t-[1.5px] border-b-transparent border-primary"
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            />
          </>
        )}

        {variant === "magnetic-dots" && (
          <div className="relative flex h-full w-full items-center justify-center">
            <motion.div
              className="absolute rounded-full bg-primary"
              style={{ height: finalSize / 3, width: finalSize / 3 }}
              animate={{ x: [-(finalSize / 3), 0, -(finalSize / 3)] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut", times: [0, 0.5, 1] }}
            />
            <motion.div
              className="absolute rounded-full bg-primary"
              style={{ height: finalSize / 3, width: finalSize / 3 }}
              animate={{ x: [finalSize / 3, 0, finalSize / 3] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut", times: [0, 0.5, 1] }}
            />
            <motion.div
              className="absolute rounded-full bg-primary opacity-0"
              style={{ height: finalSize / 3, width: finalSize / 3 }}
              animate={{ opacity: [0, 1, 0] }}
              transition={{ repeat: Infinity, duration: 1.2, ease: "easeInOut", times: [0.45, 0.5, 0.55] }}
            />
          </div>
        )}
      </div>

      {children && <div className="text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}
