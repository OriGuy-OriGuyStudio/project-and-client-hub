import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Floating "back to top" button for long, scroll-heavy pages. Fades in once the
 * window is scrolled past a threshold and smooth-scrolls to the top on click.
 * Anchored to the inline-end (right in RTL) so it never collides with the
 * bottom-left AI bubble.
 */
export function BackToTop() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <button
      type="button"
      aria-label="חזרה למעלה"
      title="חזרה למעלה"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={cn(
        "fixed bottom-6 right-4 z-40 flex size-11 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lift transition-all duration-300 ease-soft hover:bg-primary hover:text-primary-foreground sm:right-6",
        show ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
      )}
    >
      <ArrowUp className="size-5" />
    </button>
  );
}
