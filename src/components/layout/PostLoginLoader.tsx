import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { NumberLoader } from "./NumberLoader";

/** sessionStorage flag set by signInWithGoogle before the OAuth redirect. */
export const POST_LOGIN_FLAG = "sog-postlogin";

/**
 * Plays the number/bar loader ONCE right after a successful sign-in, before the
 * dashboard is revealed. Armed by `signInWithGoogle` (sets POST_LOGIN_FLAG) and
 * fired when auth resolves to authenticated. A plain refresh while already
 * signed in does NOT replay it — only an actual login does.
 */
export function PostLoginLoader() {
  const { status } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (status === "authenticated" && sessionStorage.getItem(POST_LOGIN_FLAG) === "1") {
      sessionStorage.removeItem(POST_LOGIN_FLAG);
      setShow(true);
    } else if (status === "unauthenticated" || status === "denied") {
      // Login didn't complete — clear the flag so it can't fire later.
      sessionStorage.removeItem(POST_LOGIN_FLAG);
    }
  }, [status]);

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
