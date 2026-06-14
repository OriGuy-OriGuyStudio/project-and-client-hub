import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import Matter from "matter-js";
import { X } from "lucide-react";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { celebrate } from "@/lib/confetti";

/**
 * Hidden easter egg: a physics "rain" of brand shapes (logo mark, sparkles,
 * stars, brand-color dots) that the visitor can fling around with the cursor.
 * Adapted from Osmo Supply's "Falling 2D Objects" (Matter.js) into a full-screen
 * overlay. Skips entirely under prefers-reduced-motion.
 */

const dot = (c: string) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><circle cx="64" cy="64" r="56" fill="${c}"/></svg>`
  );

const sparkle = (c: string) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><path d="M64 8c6 30 20 44 48 56-28 12-42 26-48 56-6-30-20-44-48-56 28-12 42-26 48-56z" fill="${c}"/></svg>`
  );

const star = (c: string) =>
  "data:image/svg+xml," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><path d="M64 12l15 34 37 3-28 24 9 36-33-20-33 20 9-36-28-24 37-3z" fill="${c}"/></svg>`
  );

const SHAPES = [
  dot("#B4D670"),
  dot("#77becf"),
  dot("#8b7bf0"),
  sparkle("#B4D670"),
  star("#cbe7a0"),
  "/brand/logo-mark.svg",
];

export default function FallingEasterEgg({
  active,
  onClose,
}: {
  active: boolean;
  onClose: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const [leaving, setLeaving] = useState(false);

  // Celebration + auto-dismiss: fireworks on open, then fade away on its own so it
  // never blocks the page.
  useEffect(() => {
    if (!active) return;
    if (reduced) {
      onClose(); // reduced motion: don't show; reset the trigger
      return;
    }
    setLeaving(false);
    const bursts = [0, 600, 1300, 2200].map((d) => setTimeout(() => celebrate(), d));
    const fade = setTimeout(() => setLeaving(true), 7000); // longer, time to read
    const done = setTimeout(() => onClose(), 7000 + 800);
    return () => {
      bursts.forEach(clearTimeout);
      clearTimeout(fade);
      clearTimeout(done);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, reduced]);

  useEffect(() => {
    if (!active || reduced) return;
    const host = hostRef.current;
    if (!host) return;

    const W = window.innerWidth;
    const H = window.innerHeight;
    const { Engine, Render, Runner, Bodies, Composite, Mouse, MouseConstraint } = Matter;

    const engine = Engine.create();
    engine.world.gravity.y = 1.3;

    const render = Render.create({
      element: host,
      engine,
      options: {
        width: W,
        height: H,
        background: "transparent",
        wireframes: false,
        pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
      },
    });

    const wall = 300;
    Composite.add(engine.world, [
      Bodies.rectangle(W / 2, H + wall / 2, W + wall * 2, wall, { isStatic: true }),
      Bodies.rectangle(-wall / 2, H / 2, wall, H * 3, { isStatic: true }),
      Bodies.rectangle(W + wall / 2, H / 2, wall, H * 3, { isStatic: true }),
    ]);

    Render.run(render);
    const runner = Runner.create();
    Runner.run(runner, engine);

    const size = Math.max(48, Math.min(W, H) / 9);
    const scale = size / 128;
    let i = 0;
    let n = 0;
    const max = 24;
    let timer = 0 as unknown as ReturnType<typeof setTimeout>;
    const drop = () => {
      const tex = SHAPES[i % SHAPES.length];
      i++;
      Composite.add(
        engine.world,
        Bodies.rectangle(Math.random() * (W - size) + size / 2, -size, size, size, {
          chamfer: { radius: size / 2 },
          restitution: 0.65,
          friction: 0.05,
          render: { sprite: { texture: tex, xScale: scale, yScale: scale } },
        })
      );
      n++;
      if (n < max) timer = setTimeout(drop, 85);
    };
    drop();

    const mouse = Mouse.create(render.canvas);
    const mc = MouseConstraint.create(engine, {
      mouse,
      constraint: { stiffness: 0.2, render: { visible: false } },
    });
    Composite.add(engine.world, mc);

    return () => {
      clearTimeout(timer);
      Render.stop(render);
      Runner.stop(runner);
      Composite.clear(engine.world, false);
      Engine.clear(engine);
      render.canvas.remove();
    };
  }, [active, reduced]);

  if (!active || reduced) return null;

  return (
    <motion.div
      dir="rtl"
      initial={{ opacity: 0 }}
      animate={{ opacity: leaving ? 0 : 1 }}
      transition={{ duration: 0.7, ease: "easeInOut" }}
      className="fixed inset-0 z-[70] bg-[#0a0910]/85 backdrop-blur-sm"
      role="dialog"
      aria-label="הפתעה"
    >
      {/* physics canvas */}
      <div ref={hostRef} className="absolute inset-0" />

      {/* motivational message */}
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 140, damping: 14 }}
        >
          <span className="text-5xl sm:text-6xl">🎉</span>
          <h2 className="mt-4 font-heading text-3xl font-black text-white sm:text-5xl">
            מצאת את ההפתעה.
          </h2>
          <p className="mx-auto mt-3 max-w-md text-base leading-relaxed text-white/70 sm:text-lg">
            הסקרנות הזו, לחפש ולגלות את מה שאחרים מפספסים, היא בדיוק מה שאני שם
            בכל אתר שאני בונה.
          </p>
        </motion.div>
      </div>

      <button
        onClick={onClose}
        className="absolute right-5 top-5 z-10 flex size-11 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white shadow-lift backdrop-blur transition-transform hover:scale-110"
        aria-label="סגירה"
      >
        <X className="size-5" />
      </button>
    </motion.div>
  );
}
