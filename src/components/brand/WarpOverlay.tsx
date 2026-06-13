import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import gsap from "gsap";
import { Starfield } from "@/components/ui/starfield-1";
import { Button } from "@/components/ui/button";
import { onWarp } from "@/lib/warp";
import { celebrate } from "@/lib/confetti";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const FADE_IN = 1600; // stars fade/approach in
const SHAKE_MS = 2500; // takeoff rumble, then a smooth cruise
const TEXT_DELAY = 1.9; // seconds, GSAP text entrance
const LAND_START = 8400; // begin landing fade
const FADE_OUT = 1600;
const END = 10000; // total ~10s

type RewardInfo = { coins: number; enrolled: boolean };

/**
 * The "warp" easter egg. Clicking the Orion footer wordmark rumbles the app like
 * a cockpit on takeoff, then a calm white starfield FADES in (as if approaching
 * the stars) for ~10s with a GSAP line, then fades back out ("lands"). A client
 * who discovers it earns 5 credits + the curious badge (once) — a popup they
 * confirm, which sets off fireworks. Skipped for reduced-motion users.
 */
export function WarpOverlay() {
  const reduced = usePrefersReducedMotion();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [active, setActive] = useState(false);
  const [entered, setEntered] = useState(false);
  const [landing, setLanding] = useState(false);
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
    root?.classList.add("warp-shake");
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const raf = requestAnimationFrame(() => setEntered(true)); // trigger fade-in

    const ctx = gsap.context(() => {
      if (textRef.current) {
        gsap.fromTo(
          textRef.current,
          { opacity: 0, y: 34, scale: 0.92, filter: "blur(10px)" },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            filter: "blur(0px)",
            duration: 1.6,
            delay: TEXT_DELAY,
            ease: "power3.out",
          }
        );
      }
    });

    const tShakeOff = window.setTimeout(
      () => root?.classList.remove("warp-shake"),
      SHAKE_MS
    );
    const tLand = window.setTimeout(() => setLanding(true), LAND_START);
    const tEnd = window.setTimeout(() => {
      setActive(false);
      setEntered(false);
      setLanding(false);
      void claimReward();
    }, END);

    return () => {
      cancelAnimationFrame(raf);
      ctx.revert();
      window.clearTimeout(tShakeOff);
      window.clearTimeout(tLand);
      window.clearTimeout(tEnd);
      root?.classList.remove("warp-shake");
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  async function claimReward() {
    if (profile?.role !== "client") return;
    const { data, error } = await supabase.rpc("claim_easter_egg");
    if (error || !data?.granted) return; // already claimed → no popup
    setReward({ coins: data.coins ?? 5, enrolled: !!data.enrolled });
    qc.invalidateQueries({ queryKey: ["client-partner"] });
    qc.invalidateQueries({ queryKey: ["curious-badge"] });
  }

  function confirmReward() {
    celebrate();
    setReward(null);
  }

  return (
    <>
      {active && (
        <div
          aria-hidden
          className="fixed inset-0 z-[10001] flex items-center justify-center"
          style={{
            opacity: entered && !landing ? 1 : 0,
            transitionProperty: "opacity",
            transitionTimingFunction: "ease",
            transitionDuration: `${landing ? FADE_OUT : FADE_IN}ms`,
          }}
        >
          <Starfield
            starColor="rgba(255,255,255,0.95)"
            bgColor="rgba(6,6,10,1)"
            speed={2.4}
            quantity={560}
          />
          <div
            ref={textRef}
            className="pointer-events-none relative z-10 max-w-3xl px-6 text-center font-heading text-3xl font-black leading-tight text-white sm:text-5xl"
            style={{ opacity: 0, textShadow: "0 0 30px rgba(180,214,112,0.45)" }}
          >
            שברתם את המחסום,
            <br />
            גם השמים הם לא הגבול
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
