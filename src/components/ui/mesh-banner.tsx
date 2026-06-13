import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { MeshGradient } from "@paper-design/shaders-react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { cn } from "@/lib/utils";

/** If the WebGL shader can't init, fall back to the CSS gradient behind it. */
class ShaderBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * An animated mesh-gradient banner (WebGL, via @paper-design/shaders-react). Sized
 * to its container with a ResizeObserver; the canvas is CSS-stretched to fill so a
 * coarse shader resolution still covers the box. A static CSS gradient sits behind
 * as a pre-mount fallback. Honours prefers-reduced-motion by freezing the shader.
 */
export function MeshBanner({
  colors,
  className,
}: {
  colors: string[];
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const [dim, setDim] = useState({ w: 1000, h: 220 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect;
      setDim({ w: Math.max(1, Math.round(r.width)), h: Math.max(1, Math.round(r.height)) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={cn("relative overflow-hidden", className)}
      style={{ backgroundImage: `linear-gradient(135deg, ${colors.join(", ")})` }}
    >
      <div className="absolute inset-0 [&_canvas]:!block [&_canvas]:!h-full [&_canvas]:!w-full">
        <ShaderBoundary>
          <MeshGradient
            width={dim.w}
            height={dim.h}
            colors={colors}
            distortion={0.85}
            swirl={0.65}
            speed={reduced ? 0 : 0.32}
            offsetX={0.08}
            grainMixer={0}
            grainOverlay={0}
          />
        </ShaderBoundary>
      </div>
    </div>
  );
}
