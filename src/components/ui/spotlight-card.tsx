import { useRef, useState, type MouseEventHandler, type PropsWithChildren } from "react";

interface SpotlightCardProps extends PropsWithChildren {
  className?: string;
  /** Spotlight tint; defaults to the brand green. */
  spotlightColor?: string;
}

/**
 * A card whose surface lights up with a soft radial spotlight that follows the
 * cursor. Adapted from React Bits (reactbits.dev) - brand-tinted, no deps. Pass
 * the card's own border/bg/rounded/padding via `className`.
 */
export default function SpotlightCard({
  children,
  className = "",
  spotlightColor = "rgba(180, 214, 112, 0.16)",
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const onMove: MouseEventHandler<HTMLDivElement> = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
  };

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseEnter={() => setOpacity(0.6)}
      onMouseLeave={() => setOpacity(0)}
      className={"relative overflow-hidden " + className}
    >
      <div
        className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-500"
        style={{
          opacity,
          background: `radial-gradient(circle at ${pos.x}px ${pos.y}px, ${spotlightColor}, transparent 70%)`,
        }}
      />
      {children}
    </div>
  );
}
