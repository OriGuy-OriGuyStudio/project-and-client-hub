import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import gsap from "gsap";
import { Starfield } from "@/components/ui/starfield-1";
import { Globe } from "@/components/ui/globe";
import { Button } from "@/components/ui/button";
import { onWarp } from "@/lib/warp";
import { celebrate } from "@/lib/confetti";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

// Choreography (ms from takeoff). Phases overlap so every transition flows:
const LIFT_AT = 2300; // earth (now risen) drops + shrinks; stars brighten in parallel
const CRUISE_AT = 3500; // calm cruise among the stars; the line enters
const TEXT_OUT_AT = 6300; // the line fades out…
const LAND_AT = 7600; // …fully gone (~1.1s later) before the earth rises back
const GLOBE_OUT_AT = 9400; // earth fades on the new horizon
const CLOSE_AT = 10000; // space gently fades away
const END = 10800; // unmount + claim reward

const STARS_TRANSITION = 2000; // ms — slow brightness ramp, no popping

type Phase = "launch" | "cruise" | "landing";
type RewardInfo = { coins: number; enrolled: boolean };

/**
 * The "warp" easter egg. Clicking the Orion footer wordmark launches a short space
 * journey: a half-Earth rises on the horizon (heavy takeoff rumble), drops away as
 * the starfield brightens, a calm cruise with the line "שברתם את המחסום…", then
 * re-entry — Earth rises back and fades on a new horizon — before everything
 * settles. A client who discovers it earns 5 credits + the curious badge (once).
 * Skipped for reduced-motion users.
 */
export function WarpOverlay() {
  const reduced = usePrefersReducedMotion();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [active, setActive] = useState(false);
  const [visible, setVisible] = useState(false); // master overlay fade in/out
  const [phase, setPhase] = useState<Phase>("launch");
  const [entered, setEntered] = useState(false); // earth has risen into view
  const [lifting, setLifting] = useState(false); // earth dropping away on takeoff
  const [starsBright, setStarsBright] = useState(false);
  const [globeOut, setGlobeOut] = useState(false); // earth fading after re-entry
  const [reward, setReward] = useState<RewardInfo | null>(null);
  const textRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return onWarp(() => {
      if (reduced) return;
      setActive(true); // no-op if already running → ignores re-triggers
    });
  }, [reduced]);

  useEffect(() => {
    if (!active) return;
    const root = document.getElementById("root");
    const strong = () => {
      root?.classList.add("warp-shake-strong");
      root?.classList.remove("warp-shake");
    };
    const calm = () => root?.classList.remove("warp-shake-strong", "warp-shake");
    strong(); // heavy takeoff rumble while the earth is in frame
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Next frame: fade the space in and let the earth rise from below the horizon
    // (the initial below-screen + transparent state must paint first to animate).
    const raf = requestAnimationFrame(() => {
      setVisible(true);
      setEntered(true);
    });

    const tLift = window.setTimeout(() => {
      setLifting(true); // earth drops + shrinks away…
      setStarsBright(true); // …as the stars brighten in the same beat (no black gap)
    }, LIFT_AT);

    const tCruise = window.setTimeout(() => {
      setPhase("cruise");
      calm(); // smooth cruise
      gsap.fromTo(
        textRef.current,
        { opacity: 0, y: 22, scale: 0.96, force3D: true },
        { opacity: 1, y: 0, scale: 1, duration: 1.6, ease: "power2.out" }
      );
    }, CRUISE_AT);

    const tTextOut = window.setTimeout(() => {
      gsap.to(textRef.current, { opacity: 0, y: -18, duration: 0.8, ease: "power2.in" });
    }, TEXT_OUT_AT);

    const tLand = window.setTimeout(() => {
      setPhase("landing"); // earth rises back from below…
      setStarsBright(false); // …and the stars dim as we descend to a new world
      strong(); // re-entry turbulence
    }, LAND_AT);

    const tGlobeOut = window.setTimeout(() => setGlobeOut(true), GLOBE_OUT_AT);

    const tClose = window.setTimeout(() => {
      calm();
      setVisible(false); // space fades away, revealing the app again
    }, CLOSE_AT);

    const tEnd = window.setTimeout(() => {
      setActive(false);
      setPhase("launch");
      setEntered(false);
      setLifting(false);
      setStarsBright(false);
      setGlobeOut(false);
      void claimReward();
    }, END);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(tLift);
      window.clearTimeout(tCruise);
      window.clearTimeout(tTextOut);
      window.clearTimeout(tLand);
      window.clearTimeout(tGlobeOut);
      window.clearTimeout(tClose);
      window.clearTimeout(tEnd);
      calm();
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  async function claimReward() {
    if (profile?.role !== "client" && profile?.role !== "partner") return;
    const { data, error } = await supabase.rpc("claim_easter_egg");
    if (error || !data?.granted) return; // already claimed / not eligible → no popup
    setReward({ coins: data.coins ?? 5, enrolled: !!data.enrolled });
    // Refresh the relevant coin balance + the badge for whichever role claimed.
    qc.invalidateQueries({ queryKey: profile.role === "partner" ? ["partner-me"] : ["client-partner"] });
    qc.invalidateQueries({ queryKey: ["curious-badge"] });
  }

  function confirmReward() {
    celebrate();
    setReward(null);
  }

  // Earth's position per phase — rises from below the horizon, holds as a
  // half-globe, drops + shrinks away on takeoff, gone during the cruise, then
  // rises back full-size on re-entry and fades out. Transforms animate via CSS.
  const HORIZON = "translateY(42%) scale(1.1)"; // half-globe sitting on the bottom edge
  const BELOW = "translateY(125%) scale(1)"; // fully below the screen
  function globeTransform(): string {
    if (phase === "launch") {
      if (lifting) return "translateY(190%) scale(0.03)"; // drop + shrink into the distance
      return entered ? HORIZON : BELOW; // rise from below → horizon
    }
    if (phase === "landing") return HORIZON; // rises back up, full size
    return "translateY(210%) scale(0.02)"; // cruise — out of sight below
  }
  const globeVisible =
    (phase === "launch" && entered && !lifting) || (phase === "landing" && !globeOut);

  // Stars live behind the earth the whole time (never a black void): faint at the
  // surface, bright on the cruise, dim again on descent.
  const starOpacity = phase === "landing" ? 0.18 : starsBright ? 1 : 0.4;

  return (
    <>
      {active && (
        <div
          aria-hidden
          className="fixed inset-0 z-[10001] flex items-center justify-center overflow-hidden bg-[#06060a]"
          style={{
            opacity: visible ? 1 : 0,
            transitionProperty: "opacity",
            transitionTimingFunction: "ease",
            transitionDuration: visible ? "450ms" : "750ms",
          }}
        >
          {/* Stars — always present behind the earth; brightness ramps with speed. */}
          <div
            className="absolute inset-0"
            style={{
              opacity: starOpacity,
              transitionProperty: "opacity",
              transitionTimingFunction: "ease",
              transitionDuration: `${STARS_TRANSITION}ms`,
            }}
          >
            <Starfield
              starColor="rgba(255,255,255,0.95)"
              bgColor="rgba(6,6,10,1)"
              speed={2.4}
              quantity={560}
            />
          </div>

          {/* Earth — anchored to the bottom so only the upper half shows. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center">
            <div
              className="origin-bottom"
              style={{
                transform: globeTransform(),
                opacity: globeVisible ? 1 : 0,
                transitionProperty: "transform, opacity",
                transitionTimingFunction: "cubic-bezier(0.33, 1, 0.68, 1)",
                transitionDuration: "1800ms, 1300ms",
              }}
            >
              <Globe size={560} />
            </div>
          </div>

          <div ref={textRef} className="pointer-events-none relative z-10" style={{ opacity: 0 }}>
            <div
              className="warp-float max-w-3xl px-6 text-center font-heading text-3xl font-black leading-tight text-white sm:text-5xl"
              style={{ textShadow: "0 0 30px rgba(180,214,112,0.45)" }}
            >
              שברתם את המחסום,
              <br />
              גם השמים הם לא הגבול
            </div>
          </div>
        </div>
      )}

      {reward && (
        <div className="fixed inset-0 z-[10002] flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-7 text-center shadow-2xl">
            <div className="text-5xl">🪙</div>
            <h2 className="mt-3 font-heading text-2xl font-black text-foreground">
              גילית את הסוד!
            </h2>
            <p className="mt-2 text-foreground">
              זכית ב-
              <span className="font-bold text-primary">{reward.coins} מטבעות</span> על
              הסקרנות. ✨
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              וקיבלת את תג <span className="font-semibold text-foreground">הסקרן 🔭</span>.
            </p>
            {!reward.enrolled && (
              <p className="mt-3 rounded-xl bg-primary/10 px-3 py-2 text-sm text-foreground">
                המטבעות שמורים לך. ברגע שתיפתח לך תוכנית השותפים, תתחיל עם{" "}
                {reward.coins} בכיס.
              </p>
            )}
            <Button className="mt-5 w-full" onClick={confirmReward}>
              אישור וקבלה
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
