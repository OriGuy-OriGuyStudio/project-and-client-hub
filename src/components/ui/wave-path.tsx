import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

type WavePathProps = React.ComponentProps<"div">;

/**
 * A thin horizontal divider that bows like a string when you drag the pointer
 * across it (adapted from a community component to span its container width and
 * inherit the current text color for the stroke).
 */
export function WavePath({ className, ...props }: WavePathProps) {
  const root = useRef<HTMLDivElement>(null);
  const path = useRef<SVGPathElement>(null);
  const progress = useRef(0);
  const x = useRef(0.5);
  const time = useRef(Math.PI / 2);
  const reqId = useRef<number | null>(null);

  const setPath = (value: number) => {
    const width = root.current?.clientWidth ?? 0;
    path.current?.setAttributeNS(
      null,
      "d",
      `M0 50 Q${width * x.current} ${50 + value * 0.6}, ${width} 50`
    );
  };

  useEffect(() => {
    setPath(0);
    const onResize = () => setPath(progress.current);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t;

  const resetAnimation = () => {
    time.current = Math.PI / 2;
    progress.current = 0;
  };

  const animateOut = () => {
    const newProgress = progress.current * Math.sin(time.current);
    progress.current = lerp(progress.current, 0, 0.025);
    time.current += 0.2;
    setPath(newProgress);
    if (Math.abs(progress.current) > 0.75) {
      reqId.current = requestAnimationFrame(animateOut);
    } else {
      resetAnimation();
    }
  };

  const onEnter = () => {
    if (reqId.current) {
      cancelAnimationFrame(reqId.current);
      resetAnimation();
    }
  };

  const onMove = (e: React.MouseEvent) => {
    const bounds = path.current?.getBoundingClientRect();
    if (!bounds) return;
    x.current = (e.clientX - bounds.left) / bounds.width;
    progress.current += e.movementY;
    setPath(progress.current);
  };

  const onLeave = () => animateOut();

  return (
    <div
      ref={root}
      className={cn("relative h-px w-full text-border", className)}
      {...props}
    >
      <div
        onMouseEnter={onEnter}
        onMouseMove={onMove}
        onMouseLeave={onLeave}
        className="relative -top-3 z-10 h-6 w-full hover:-top-[40px] hover:h-20"
      />
      <svg className="absolute -top-[50px] h-[100px] w-full" aria-hidden>
        <path ref={path} className="fill-none stroke-current" strokeWidth={1.5} />
      </svg>
    </div>
  );
}
