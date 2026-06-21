import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Fit = "cover" | "contain";

/**
 * Logo image that auto-picks object-fit so we don't have to guess per client:
 *
 * - A mark / wordmark with transparent edges (a logo on no background) is shown
 *   whole — `object-contain` ("fit"), so nothing gets cropped.
 * - An opaque, roughly-square image (a full-bleed tile or photo) fills the
 *   frame — `object-cover` ("fill").
 *
 * The decision uses the image's aspect ratio plus the alpha of its four corners
 * (sampled on a tiny off-screen canvas). If the pixels can't be inspected
 * (a cross-origin URL without CORS taints the canvas) we fall back to `contain`,
 * which never crops — the safe choice for a logo.
 */
export function BrandLogo({
  src,
  alt = "",
  className,
}: {
  src: string;
  alt?: string;
  className?: string;
}) {
  const [fit, setFit] = useState<Fit>("contain");

  useEffect(() => {
    if (!src) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      if (!cancelled) setFit(decideFit(img));
    };
    img.onerror = () => {
      if (!cancelled) setFit("contain");
    };
    img.src = src;
    return () => {
      cancelled = true;
    };
  }, [src]);

  return (
    <img
      src={src}
      alt={alt}
      className={cn(fit === "cover" ? "object-cover" : "object-contain", className)}
    />
  );
}

function decideFit(img: HTMLImageElement): Fit {
  const w = img.naturalWidth;
  const h = img.naturalHeight;
  if (!w || !h) return "contain";

  // A wordmark / banner that isn't roughly square should never be cropped.
  const ratio = w / h;
  if (ratio < 0.8 || ratio > 1.25) return "contain";

  // Roughly square: transparent corners mean it's a mark on no background →
  // show it whole. Opaque corners mean it's a full tile → fill the frame.
  try {
    const s = 24;
    const canvas = document.createElement("canvas");
    canvas.width = s;
    canvas.height = s;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return "cover";
    ctx.drawImage(img, 0, 0, s, s);
    const alphaAt = (x: number, y: number) => ctx.getImageData(x, y, 1, 1).data[3];
    const corners = [
      alphaAt(0, 0),
      alphaAt(s - 1, 0),
      alphaAt(0, s - 1),
      alphaAt(s - 1, s - 1),
    ];
    const transparent = corners.filter((a) => a < 16).length;
    return transparent >= 2 ? "contain" : "cover";
  } catch {
    return "contain"; // tainted canvas — never crop a logo
  }
}
