import { cn } from "@/lib/utils";

interface GlobeProps {
  /** Diameter in px. */
  size?: number;
  className?: string;
}

/**
 * A CSS-only rotating Earth: an equirectangular texture (self-hosted in
 * /public/brand/globe.jpeg) wrapped on a circle, scrolled via background-position
 * for the spin. The heavy inset box-shadows fake a lit terminator so one side
 * stays in shadow — a 3D-ish "half-lit" sphere. Adapted from a 21st.dev component
 * (image localized, sized via prop, keyframes moved to index.css).
 */
export function Globe({ size = 250, className }: GlobeProps) {
  return (
    <div
      className={cn(
        "rounded-full shadow-[0_0_20px_rgba(255,255,255,0.2),-5px_0_8px_#c3f4ff_inset,15px_2px_25px_#000_inset,-24px_-2px_34px_#c3f4ff99_inset,250px_0_44px_#00000066_inset,150px_0_38px_#000000aa_inset]",
        className
      )}
      style={{
        width: size,
        height: size,
        backgroundImage: "url('/brand/globe.jpeg')",
        backgroundSize: "cover",
        backgroundPosition: "left",
        animation: "earthRotate 30s linear infinite",
      }}
    />
  );
}

export default Globe;
