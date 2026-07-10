import { useEffect, useRef } from "react";
import { TURNSTILE_SITE_KEY } from "@/lib/turnstile";

// Renders a Cloudflare Turnstile widget (managed/invisible CAPTCHA). Calls
// onToken with the solved token, or "" when it expires/errors. Loads the script
// once. The parent verifies the token server-side before submitting.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TurnstileApi = any;
declare global {
  interface Window { turnstile?: TurnstileApi }
}

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | null = null;
function loadScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = SCRIPT_SRC;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("turnstile script failed to load"));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function TurnstileWidget({
  onToken,
  theme = "dark",
}: {
  onToken: (token: string) => void;
  theme?: "dark" | "light" | "auto";
}) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onToken);
  cb.current = onToken;
  const widgetId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(ref.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme,
          callback: (token: string) => cb.current(token),
          "expired-callback": () => cb.current(""),
          "error-callback": () => cb.current(""),
        });
      })
      .catch(() => cb.current(""));
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        try { window.turnstile.remove(widgetId.current); } catch { /* ignore */ }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={ref} />;
}
