import { useEffect, useRef, type AnchorHTMLAttributes } from "react";
import gsap from "gsap";
import { SplitText } from "gsap/SplitText";
import { cn } from "@/lib/utils";

gsap.registerPlugin(SplitText);

/**
 * Brand CTA link (Osmo Supply "Button 004"). Each letter flips on hover via
 * GSAP SplitText. `label` must be plain text so it can be split into chars.
 */
export function FancyButton({
  label,
  className,
  ...props
}: { label: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const texts = el.querySelectorAll<HTMLElement>("[data-button-004-text]");
    const splits: SplitText[] = [];

    texts.forEach((textEl) => {
      const split = new SplitText(textEl, {
        type: "chars",
        tag: "span",
        charsClass: "button-004__split-char",
      });
      splits.push(split);

      const chars = split.chars;
      const center = (chars.length - 1) / 2;
      textEl.style.setProperty("--max-index", String(Math.floor(center)));

      chars.forEach((char, index) => {
        const distance = Math.floor(Math.abs(index - center));
        const signedIndex = index < center ? distance : index > center ? -distance : 0;
        (char as HTMLElement).style.setProperty("--index", String(distance));
        (char as HTMLElement).style.setProperty("--signed-index", String(signedIndex));
      });
    });

    return () => splits.forEach((s) => s.revert());
  }, [label]);

  return (
    <a ref={ref} data-button-004 className={cn("button-004", className)} {...props}>
      <span className="button-004__inner">
        <span data-button-004-text className="button-004__text is--default">
          {label}
        </span>
        <span aria-hidden data-button-004-text className="button-004__text is--hover">
          {label}
        </span>
      </span>
      <span className="button-004__bg" />
    </a>
  );
}
