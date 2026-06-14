import { useEffect, useRef } from "react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

interface AutoScrollShotProps {
  title: string;
  subtitle?: string;
  /** Small status pill, e.g. "בקרוב" / "בעבודה". */
  status?: string;
  /** Video sources (a muted screen recording). WebM is smaller; MP4/H.264 is the
   *  safe fallback for Safari/iOS. A still poster shows before play. */
  webm?: string;
  mp4?: string;
  poster?: string;
  /** Taller viewport - used for the featured/hero portfolio item. */
  tall?: boolean;
  /** Stretch to fill the parent's height (featured item matching a stacked column). */
  fill?: boolean;
}

/**
 * A browser-framed preview of a real project. When a video is supplied it plays a
 * muted, looping screen recording (so the site's animations show, not just a static
 * shot) and only plays while in view; reduced-motion users see the poster. Until a
 * recording lands it animates a placeholder "page" so the layout is already there.
 */
export function AutoScrollShot({ title, subtitle, status, webm, mp4, poster, tall, fill }: AutoScrollShotProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduced = usePrefersReducedMotion();
  const hasVideo = !!(webm || mp4);

  // Play only while scrolled into view (and never under reduced-motion).
  useEffect(() => {
    const v = videoRef.current;
    if (!v || reduced) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) void v.play().catch(() => {});
        else v.pause();
      },
      { threshold: 0.4 }
    );
    io.observe(v);
    return () => io.disconnect();
  }, [reduced]);

  return (
    <div className={"flex w-full flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft " + (fill ? "h-full" : "")}>
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 border-b border-border bg-background/40 px-3 py-2">
        <span className="size-2.5 rounded-full bg-destructive/60" />
        <span className="size-2.5 rounded-full bg-[#f5c451]/70" />
        <span className="size-2.5 rounded-full bg-brand-green-base/70" />
        <span className="mx-auto truncate rounded-md bg-background/60 px-3 py-0.5 font-mono-code text-[10px] text-muted-foreground">
          {title}
        </span>
      </div>

      {/* Viewport */}
      <div
        className={
          "relative overflow-hidden bg-[#0d0c12] " +
          (fill ? "min-h-64 flex-1" : tall ? "h-[28rem] sm:h-[34rem]" : "h-64")
        }
      >
        {hasVideo ? (
          <video
            ref={videoRef}
            poster={poster}
            muted
            loop
            playsInline
            preload="none"
            className="h-full w-full object-cover"
          >
            {webm && <source src={webm} type="video/webm" />}
            {mp4 && <source src={mp4} type="video/mp4" />}
          </video>
        ) : (
          <PlaceholderPage />
        )}
        {status && (
          <span className="absolute right-3 top-3 rounded-full border border-primary/40 bg-card/90 px-2.5 py-0.5 text-[11px] font-medium text-primary backdrop-blur">
            {status}
          </span>
        )}
      </div>

      <div className="px-4 py-3">
        <p className="font-heading text-sm font-bold text-foreground">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

/** A mock "long page" that reads as a scrolling website until a real recording lands. */
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
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg bg-foreground/[0.06]" />
        ))}
      </div>
      <div className="h-24 rounded-xl bg-gradient-to-tr from-brand-green-base/20 to-brand-cyan-base/20" />
      <div className="flex justify-center pt-2 text-[11px] text-muted-foreground">
        סרטון בקרוב
      </div>
    </div>
  );
}
