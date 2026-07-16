import React, { useRef, useState, useMemo } from "react";
import { motion, useInView, type Transition } from "framer-motion";
import "./blur-highlight.css";

export interface HighlightBit {
  text: string;
  occurrence?: number;
}

export interface BlurHighlightProps {
  children: React.ReactNode;
  highlightedBits?: (string | HighlightBit)[];
  highlightColor?: string;
  highlightClassName?: string;
  blurAmount?: number;
  inactiveOpacity?: number;
  blurDelay?: number;
  blurDuration?: number;
  highlightDelay?: number;
  highlightDuration?: number;
  highlightDirection?: "left" | "right" | "top" | "bottom";
  viewportOptions?: {
    once?: boolean;
    amount?: number;
  };
  className?: string;
}

export interface BlurHighlightRef {
  trigger: () => void;
  reset: () => void;
}

type BackgroundMetrics = { initial: string; animated: string; position: string };

/** One highlighted run of text. Hoisted out of the parent's render (the
 *  original source defined this inline inside a `.map`, which trips the
 *  rules-of-hooks lint since it calls `useInView`/`useRef`) so each highlight
 *  is a proper component instance keyed by the parent. */
function HighlightWrapper({
  children,
  highlightColor,
  highlightClassName,
  metrics,
  transition,
}: {
  children: React.ReactNode;
  highlightColor: string;
  highlightClassName: string;
  metrics: BackgroundMetrics;
  transition: Transition;
}) {
  const highlightRef = useRef<HTMLSpanElement>(null);
  const highlightInView = useInView(highlightRef, {
    once: false,
    amount: 0.1,
  });

  const highlightStyles: React.CSSProperties = {
    backgroundImage: `linear-gradient(${highlightColor}, ${highlightColor})`,
    backgroundRepeat: "no-repeat",
    backgroundPosition: metrics.position,
    backgroundSize: highlightInView ? metrics.animated : metrics.initial,
    boxDecorationBreak: "clone",
    WebkitBoxDecorationBreak: "clone",
  } as React.CSSProperties;

  return (
    <span ref={highlightRef} className="highlight-text-wrapper">
      <motion.span
        className={`highlight-text-content ${highlightClassName}`}
        style={highlightStyles}
        animate={{
          backgroundSize: highlightInView ? metrics.animated : metrics.initial,
        }}
        initial={{
          backgroundSize: metrics.initial,
        }}
        transition={transition}
      >
        {children}
      </motion.span>
    </span>
  );
}

export const BlurHighlight = React.forwardRef<
  BlurHighlightRef,
  BlurHighlightProps
>(
  (
    {
      children,
      highlightedBits = [],
      highlightColor = "hsl(80, 100%, 50%)",
      highlightClassName = "",
      blurAmount = 8,
      inactiveOpacity = 0.3,
      blurDelay = 0,
      blurDuration = 0.8,
      highlightDelay = 0.4,
      highlightDuration = 1,
      highlightDirection = "left",
      viewportOptions = {
        once: false,
        amount: 0.5,
      },
      className = "",
    },
    ref,
  ) => {
    const containerRef = useRef<HTMLSpanElement>(null);
    const [manualTrigger, setManualTrigger] = useState(false);
    const inViewport = useInView(containerRef, {
      ...viewportOptions,
      margin: "-20%",
    });

    const isActive = manualTrigger || inViewport;

    React.useImperativeHandle(ref, () => ({
      trigger: () => setManualTrigger(true),
      reset: () => setManualTrigger(false),
    }));

    const processedContent = useMemo(() => {
      const textContent =
        typeof children === "string"
          ? children
          : React.Children.toArray(children)
              .map((child) => {
                if (typeof child === "string") return child;
                if (React.isValidElement(child)) {
                  const props = child.props as { children?: unknown };
                  if (props.children) {
                    return typeof props.children === "string"
                      ? props.children
                      : "";
                  }
                }
                return "";
              })
              .join(" ");

      if (!textContent || highlightedBits.length === 0) {
        return { parts: [{ text: textContent, highlight: false }] };
      }

      const normalizedBits = highlightedBits.map((bit) => {
        if (typeof bit === "string") {
          return { text: bit, occurrence: undefined as number | undefined };
        }
        return bit;
      });

      const matches: Array<{
        start: number;
        end: number;
        text: string;
        occurrence: number;
      }> = [];

      normalizedBits.forEach((bit) => {
        const searchText = bit.text;
        let position = 0;
        let occurrence = 0;

        while (position < textContent.length) {
          const index = textContent.indexOf(searchText, position);
          if (index === -1) break;

          occurrence++;

          if (bit.occurrence === undefined || bit.occurrence === occurrence) {
            matches.push({
              start: index,
              end: index + searchText.length,
              text: searchText,
              occurrence,
            });
          }

          position = index + 1;
        }
      });

      matches.sort((a, b) => a.start - b.start);

      const parts: Array<{ text: string; highlight: boolean }> = [];
      let currentPos = 0;

      matches.forEach((match, index) => {
        if (match.start > currentPos) {
          parts.push({
            text: textContent.slice(currentPos, match.start),
            highlight: false,
          });
        }

        if (index > 0 && match.start < matches[index - 1].end) {
          if (match.end > matches[index - 1].end) {
            parts.push({
              text: textContent.slice(matches[index - 1].end, match.end),
              highlight: true,
            });
            currentPos = match.end;
          }
        } else {
          parts.push({
            text: textContent.slice(match.start, match.end),
            highlight: true,
          });
          currentPos = match.end;
        }
      });

      if (currentPos < textContent.length) {
        parts.push({
          text: textContent.slice(currentPos),
          highlight: false,
        });
      }

      return { parts };
    }, [children, highlightedBits]);

    const getBackgroundMetrics = (): BackgroundMetrics => {
      switch (highlightDirection) {
        case "left":
          return {
            initial: "0% 100%",
            animated: "100% 100%",
            position: "0% 0%",
          };
        case "right":
          return {
            initial: "0% 100%",
            animated: "100% 100%",
            position: "100% 0%",
          };
        case "top":
          return {
            initial: "100% 0%",
            animated: "100% 100%",
            position: "0% 0%",
          };
        case "bottom":
          return {
            initial: "100% 0%",
            animated: "100% 100%",
            position: "0% 100%",
          };
        default:
          return {
            initial: "0% 100%",
            animated: "100% 100%",
            position: "0% 0%",
          };
      }
    };

    const metrics = getBackgroundMetrics();

    const highlightTransition: Transition = {
      type: "spring",
      duration: highlightDuration,
      delay: highlightDelay,
      bounce: 0,
    };

    return (
      <motion.span
        ref={containerRef}
        style={{ display: "block" }}
        initial={{
          opacity: 0,
          filter: `blur(${blurAmount}px)`,
        }}
        animate={
          isActive
            ? { opacity: 1, filter: "blur(0px)" }
            : {
                opacity: inactiveOpacity,
                filter: `blur(${blurAmount * 0.75}px)`,
              }
        }
        transition={{
          duration: blurDuration,
          delay: isActive ? blurDelay : 0,
          ease: [0.25, 0.1, 0.25, 1],
        }}
        className={`blur-highlight-container ${className}`}
      >
        {processedContent.parts.map((part, index) =>
          part.highlight ? (
            <HighlightWrapper
              key={index}
              highlightColor={highlightColor}
              highlightClassName={highlightClassName}
              metrics={metrics}
              transition={highlightTransition}
            >
              {part.text}
            </HighlightWrapper>
          ) : (
            <React.Fragment key={index}>{part.text}</React.Fragment>
          ),
        )}
      </motion.span>
    );
  },
);

BlurHighlight.displayName = "BlurHighlight";

export default BlurHighlight;
