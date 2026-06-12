import { useEffect, useState } from "react";
import { NumberLoader } from "./NumberLoader";

/**
 * Plays the number-loader intro on every full page load (app entry), above
 * everything. It's mounted app-level outside the router, so client-side
 * navigation never replays it - only a real reload / fresh load does.
 */
export function IntroLoader() {
  const [show, setShow] = useState(true);

  // Lock scroll while the curtain is up.
  useEffect(() => {
    if (!show) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [show]);

  if (!show) return null;

  return <NumberLoader onDone={() => setShow(false)} />;
}
