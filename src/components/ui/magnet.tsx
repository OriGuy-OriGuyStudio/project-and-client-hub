import { useState, useEffect, useRef, type ReactNode } from "react";

/**
 * Magnetically eases its child toward the cursor when nearby, then springs back.
 * From React Bits (reactbits.dev), zero-dep. Pass `disabled` (e.g. for reduced
 * motion / touch) to freeze it.
 */
export default function Magnet({
  children,
  padding = 90,
  disabled = false,
  magnetStrength = 3,
  wrapperClassName = "",
  innerClassName = "",
}: {
  children: ReactNode;
  padding?: number;
  disabled?: boolean;
  magnetStrength?: number;
  wrapperClassName?: string;
  innerClassName?: string;
}) {
  const [active, setActive] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (disabled) {
      setPos({ x: 0, y: 0 });
      return;
    }
    const onMove = (e: MouseEvent) => {
      const el = ref.current;
      if (!el) return;
      const { left, top, width, height } = el.getBoundingClientRect();
      const cx = left + width / 2;
      const cy = top + height / 2;
      const dx = Math.abs(cx - e.clientX);
      const dy = Math.abs(cy - e.clientY);
      if (dx < width / 2 + padding && dy < height / 2 + padding) {
        setActive(true);
        setPos({ x: (e.clientX - cx) / magnetStrength, y: (e.clientY - cy) / magnetStrength });
      } else {
        setActive(false);
        setPos({ x: 0, y: 0 });
      }
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [padding, disabled, magnetStrength]);

  return (
    <div ref={ref} className={wrapperClassName} style={{ position: "relative", display: "inline-block" }}>
      <div
        className={innerClassName}
        style={{
          transform: `translate3d(${pos.x}px, ${pos.y}px, 0)`,
          transition: active ? "transform 0.3s ease-out" : "transform 0.5s ease-in-out",
          willChange: "transform",
        }}
      >
        {children}
      </div>
    </div>
  );
}
