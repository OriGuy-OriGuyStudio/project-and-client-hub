import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

type SelectOption<T extends string> = { value: T; label: string };

/**
 * The single themed dropdown used across the app in place of the native, ugly
 * `<select>`. Built on the Radix dropdown menu so it inherits the same animated
 * open/close (origin-aware zoom) everywhere.
 *
 * - `variant="compact"` (default): small inline pill — tight spots like the
 *   roadmap status picker or a per-row status switch.
 * - `variant="field"`: full-width form control that matches `<Input>` height
 *   and rounding, with the menu sized to the trigger.
 */
export function SelectMenu<T extends string>({
  value,
  onChange,
  options,
  className,
  contentClassName,
  ariaLabel,
  placeholder,
  id,
  disabled,
  variant = "compact",
  align = variant === "field" ? "start" : "end",
}: {
  value: T;
  onChange: (value: T) => void;
  options: SelectOption<T>[];
  className?: string;
  contentClassName?: string;
  ariaLabel?: string;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  variant?: "compact" | "field";
  align?: "start" | "center" | "end";
}) {
  const current = options.find((o) => o.value === value);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          id={id}
          type="button"
          disabled={disabled}
          aria-label={ariaLabel}
          className={cn(
            "inline-flex items-center justify-between gap-1.5 border border-input bg-field text-foreground transition-colors hover:border-input/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            variant === "field"
              ? "h-10 w-full rounded-xl px-3 text-sm"
              : "h-8 rounded-lg px-2.5 text-xs",
            className
          )}
        >
          <span className={cn("truncate", !current && "text-muted-foreground")}>
            {current?.label ?? placeholder ?? ""}
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={align}
        className={cn(
          "max-h-72 overflow-y-auto",
          variant === "field"
            ? "w-[var(--radix-dropdown-menu-trigger-width)]"
            : "min-w-[9rem]",
          contentClassName
        )}
      >
        {options.map((o) => (
          <DropdownMenuItem
            key={o.value}
            onSelect={() => onChange(o.value)}
            className="justify-between"
          >
            <span>{o.label}</span>
            {o.value === value && <Check className="text-primary" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
