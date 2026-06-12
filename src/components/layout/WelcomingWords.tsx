import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { markLoginRevealed } from "@/lib/login-reveal";

/**
 * Multilingual greeting intro, adapted from Osmo Supply's "Welcoming Words
 * Loader" (GSAP). Cycles a list of greetings, then fades the curtain away to
 * reveal what's behind it (the login screen). The GSAP timeline approach is
 * preserved from the source. Hebrew leads and closes, RTL brand.
 */
const WORDS = [
  "שלום",
  "Hello",
  "Bonjour",
  "Hola",
  "Ciao",
  "Olá",
  "こんにちは",
  "Hallå",
  "ברוכים הבאים",
];

export function WelcomingWords({ onDone }: { onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null);
  const wordRef = useRef<HTMLParagraphElement>(null);
  const reduced = usePrefersReducedMotion();

  useEffect(() => {
    const el = root.current;
    const wordsEl = el?.querySelector("[data-loading-words]");
    const target = wordRef.current;
    if (!el || !wordsEl || !target) return;

    const ctx = gsap.context(() => {
      // Reduced motion: show one greeting briefly, then reveal.
      if (reduced) {
        gsap.set(wordsEl, { opacity: 1, yPercent: 0 });
        target.textContent = WORDS[0];
        gsap.to(el, { autoAlpha: 0, duration: 0.4, delay: 0.7, onComplete: onDone });
        return;
      }

      const tl = gsap.timeline();
      tl.set(wordsEl, { yPercent: 50, opacity: 0 });
      tl.to(wordsEl, { opacity: 1, yPercent: 0, duration: 1, ease: "expo.inOut" });

      WORDS.forEach((word) => {
        tl.call(
          () => {
            target.textContent = word;
          },
          undefined,
          "+=0.15"
        );
      });

      // Fade the words out, then the whole curtain — revealing the login screen.
      tl.to(
        wordsEl,
        { opacity: 0, yPercent: -75, duration: 0.8, ease: "expo.in" },
        "+=0.15"
      );
      tl.to(el, { autoAlpha: 0, duration: 0.6, ease: "power1.inOut" }, "-=0.2");
      tl.call(() => onDone());
    }, root);

    return () => ctx.revert();
    // onDone is stable (set once by the gate below); run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={root} className="welcome-loader">
      <div className="welcome-loader__screen">
        <div data-loading-words className="welcome-loader__words">
          <div className="welcome-loader__dot" />
          <p ref={wordRef} data-loading-words-target className="welcome-loader__word">
            שלום
          </p>
        </div>
      </div>
    </div>
  );
}

// Plays at most once per page load (module flag survives SPA navigation between
// the login screens, so switching /login ↔ /admin/login doesn't replay it).
let welcomePlayed = false;

/** Gate used on the login screens — shows the greeting once, then nothing. */
export function LoginIntro() {
  const [show, setShow] = useState(!welcomePlayed);

  useEffect(() => {
    welcomePlayed = true;
    // Already played this load → the screen is visible right away.
    if (!show) markLoginRevealed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!show) return null;
  return (
    <WelcomingWords
      onDone={() => {
        setShow(false);
        markLoginRevealed();
      }}
    />
  );
}
