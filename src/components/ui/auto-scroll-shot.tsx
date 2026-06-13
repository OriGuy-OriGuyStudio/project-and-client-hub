interface AutoScrollShotProps {
  /** Tall screenshot URL. When absent, a placeholder "page" auto-scrolls instead. */
  src?: string;
  title: string;
  subtitle?: string;
  /** Small status pill, e.g. "בקרוב" / "בעבודה". */
  status?: string;
}

/**
 * A browser-framed preview of a long website screenshot that auto-scrolls to show
 * the whole page in motion (lighter than video). Until a real screenshot is
 * supplied it animates a placeholder mock so the layout is already in place.
 */
export function AutoScrollShot({ src, title, subtitle, status }: AutoScrollShotProps) {
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 border-b border-border bg-background/40 px-3 py-2">
        <span className="size-2.5 rounded-full bg-destructive/60" />
        <span className="size-2.5 rounded-full bg-[#f5c451]/70" />
        <span className="size-2.5 rounded-full bg-brand-green-base/70" />
        <span className="mx-auto truncate rounded-md bg-background/60 px-3 py-0.5 font-mono-code text-[10px] text-muted-foreground">
          {title}
        </span>
      </div>

      {/* Auto-scrolling viewport */}
      <div className="relative h-64 overflow-hidden bg-[#0d0c12]">
        {src ? (
          <img src={src} alt={title} className="autoshot-scroll w-full" />
        ) : (
          <PlaceholderPage />
        )}
        {status && (
          <span className="absolute right-3 top-3 rounded-full border border-primary/40 bg-card/90 px-2.5 py-0.5 text-[11px] font-medium text-primary backdrop-blur">
            {status}
          </span>
        )}
      </div>

      {(subtitle || title) && (
        <div className="px-4 py-3">
          <p className="font-heading text-sm font-bold text-foreground">{title}</p>
          {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      )}
    </div>
  );
}

/** A mock "long page" that reads as a scrolling website until a real shot lands. */
function PlaceholderPage() {
  return (
    <div className="autoshot-scroll space-y-4 p-4">
      <div className="h-24 rounded-xl bg-gradient-to-br from-brand-cyan-base/30 via-brand-purple-base/20 to-brand-green-base/30" />
      <div className="h-3 w-2/3 rounded bg-foreground/10" />
      <div className="h-3 w-1/2 rounded bg-foreground/10" />
      <div className="grid grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg bg-foreground/[0.06]" />
        ))}
      </div>
      <div className="h-32 rounded-xl bg-foreground/[0.05]" />
      <div className="h-3 w-3/4 rounded bg-foreground/10" />
      <div className="h-3 w-2/5 rounded bg-foreground/10" />
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-foreground/[0.06]" />
        ))}
      </div>
      <div className="h-24 rounded-xl bg-gradient-to-tr from-brand-green-base/20 to-brand-cyan-base/20" />
      <div className="flex justify-center pt-2 text-[11px] text-muted-foreground">
        צילום מסך בקרוב
      </div>
    </div>
  );
}
