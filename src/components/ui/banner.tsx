import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";
import { Button } from "./button";

const bannerVariants = cva(
  "relative overflow-hidden rounded-xl border text-sm",
  {
    variants: {
      variant: {
        default: "bg-muted/40 border-border",
        brand: "border-primary/30 bg-primary/[0.06] text-foreground",
        info: "border-brand-cyan-base/30 bg-brand-cyan-base/[0.08] text-foreground",
        warning: "border-amber-500/30 bg-amber-500/[0.08] text-foreground",
      },
      size: {
        default: "py-2 px-3",
        sm: "text-xs py-1.5 px-2.5",
        lg: "text-base py-4 px-5",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
);

type BannerProps = React.ComponentProps<"div"> &
  VariantProps<typeof bannerVariants> & {
    title: string;
    description?: string;
    icon?: React.ReactNode;
    showShade?: boolean;
    show?: boolean;
    onHide?: () => void;
    action?: React.ReactNode;
    closable?: boolean;
    autoHide?: number;
  };

/** Adapted from 21st.dev (sshahaider/banner) for the brand tokens + RTL. */
export function Banner({
  variant = "default",
  size = "default",
  title,
  description,
  icon,
  showShade = false,
  show,
  onHide,
  action,
  closable = false,
  className,
  autoHide,
  ...props
}: BannerProps) {
  React.useEffect(() => {
    if (autoHide) {
      const timer = setTimeout(() => onHide?.(), autoHide);
      return () => clearTimeout(timer);
    }
  }, [autoHide, onHide]);

  if (!show) return null;

  return (
    <div
      className={cn(bannerVariants({ variant, size }), className)}
      role={variant === "warning" || variant === "default" ? "alert" : "status"}
      {...props}
    >
      {showShade && (
        <div className="pointer-events-none absolute inset-0 -z-10 -skew-x-12 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      )}

      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {icon && <div className="shrink-0">{icon}</div>}
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-foreground">{title}</p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {action}
          {closable && (
            <Button onClick={onHide} size="icon" variant="ghost" aria-label="סגירה">
              <X className="size-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
