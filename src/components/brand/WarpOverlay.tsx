import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Starfield } from "@/components/ui/starfield-1";
import { Button } from "@/components/ui/button";
import { onWarp } from "@/lib/warp";
import { celebrate } from "@/lib/confetti";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const SHAKE_LEAD = 1000; // rumble before the jump
const WARP_MS = 5000; // time among the stars
const FADE_MS = 1000; // landing fade-out

type RewardInfo = { coins: number; enrolled: boolean };

/**
 * The "warp" easter egg. Clicking the Orion footer wordmark first rattles the
 * whole app like a cockpit, then SUDDENLY drops a calm white hyperspace
 * starfield over everything, then fades out ("lands") back to normal. A client
 * who discovers it earns 5 credits + the curious badge (once) — shown in a popup
 * they confirm, which sets off fireworks. Skipped for reduced-motion users.
 */
export function WarpOverlay() {
  const reduced = usePrefersReducedMotion();
  const { profile } = useAuth();
  const qc = useQueryClient();
  const [active, setActive] = useState(false);
  const [stars, setStars] = useState(false);
  const [landing, setLanding] = useState(false);
  const [reward, setReward] = useState<RewardInfo | null>(null);

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

    const tStars = window.setTimeout(() => setStars(true), SHAKE_LEAD);
    const tLand = window.setTimeout(() => {
      setLanding(true);
      root?.classList.remove("warp-shake"); // calm the cockpit for the landing
    }, SHAKE_LEAD + WARP_MS);
    const tEnd = window.setTimeout(() => {
      setActive(false);
      setStars(false);
      setLanding(false);
      void claimReward();
    }, SHAKE_LEAD + WARP_MS + FADE_MS);

    return () => {
      window.clearTimeout(tStars);
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
      {stars && (
        <div
          aria-hidden
          className="fixed inset-0 z-[10001] transition-opacity ease-out"
          style={{ transitionDuration: `${FADE_MS}ms`, opacity: landing ? 0 : 1 }}
        >
          <Starfield
            starColor="rgba(255,255,255,0.92)"
            bgColor="rgba(7,7,11,1)"
            hyperspace
            speed={1.4}
            warpFactor={14}
            opacity={0.16}
            quantity={620}
          />
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
