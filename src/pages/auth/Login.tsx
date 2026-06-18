import { useEffect, useRef } from "react";
import gsap from "gsap";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { AuthMethods } from "@/components/auth/AuthMethods";
import { DotsGrid } from "@/components/brand/DotsGrid";
import { DiscoButton } from "@/components/brand/DiscoButton";
import { Footer } from "@/components/layout/Footer";

export default function Login() {
  const reduced = usePrefersReducedMotion();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from("[data-anim='mark']", { scale: 0.7, opacity: 0, duration: 0.5 })
        .from(
          "[data-anim='item']",
          { y: 16, opacity: 0, duration: 0.45, stagger: 0.08 },
          "-=0.2"
        );
    }, rootRef);
    return () => ctx.revert();
  }, [reduced]);

  return (
    <div
      ref={rootRef}
      className="relative isolate flex min-h-screen flex-col overflow-hidden px-6"
    >
      <div className="absolute left-4 top-4 z-20">
        <ThemeToggle />
      </div>

      {/* Interactive dots field + warm glow behind the content */}
      <DotsGrid className="-z-10" />
      <div className="pointer-events-none absolute -top-24 left-1/2 -z-10 h-80 w-80 -translate-x-1/2 rounded-full bg-primary/10 blur-[120px]" />

      <div className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 py-6 text-center sm:gap-8 sm:py-12">
        <div data-anim="mark" className="flex flex-col items-center gap-4">
          <img
            src="/brand/logo-mark.svg"
            alt="Studio Ori Guy"
            className="h-16 w-16"
          />
          <div className="space-y-1">
            <p className="font-heading text-lg font-black text-foreground">
              Studio Ori Guy
            </p>
            <p className="text-sm text-muted-foreground">Orion · הפורטל שלך</p>
          </div>
        </div>

        <div data-anim="item" className="space-y-4">
          <h1 className="font-heading text-3xl font-black leading-snug text-foreground lg:text-4xl">
            ברוך הבא ל-Orion
          </h1>
          <p className="mx-auto max-w-sm text-base leading-relaxed text-muted-foreground">
            כאן אתה רואה בדיוק איפה הפרויקט שלך עומד, מאשר מה שצריך, ומדבר איתי
            ישירות. הכול פתוח לפניך בכל רגע, בלי לחפש מיילים ישנים ובלי לשאול מה
            קורה.
          </p>
        </div>

        <AuthMethods googleLabel="התחברות עם Google" />

        <p
          data-anim="item"
          className="mx-auto max-w-sm text-xs leading-relaxed text-muted-foreground"
        >
          הגישה שמורה ללקוחות שלי. אם החשבון שלך עוד לא מזוהה, שלח לי הודעה ואני
          פותח לך גישה.
        </p>

        <p className="text-[11px] leading-relaxed text-muted-foreground/70">
          הטקסטים במערכת כתובים בלשון זכר מטעמי נוחות, ומיועדים לכל המגדרים.
        </p>
      </div>

      <div className="relative z-20 mt-4 flex flex-col items-center gap-3 sm:mt-6 sm:gap-4">
        <DiscoButton />
        <Footer className="w-full justify-center border-t-0 bg-transparent pl-4 text-[11px] sm:justify-between sm:pl-6" />
      </div>
    </div>
  );
}
