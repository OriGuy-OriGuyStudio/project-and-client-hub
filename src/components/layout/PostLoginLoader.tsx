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
  // Show the number/bar loader from the very first paint after a login (the flag
  // is set in signInWithGoogle), so it covers the auth-resolution spinner — the
  // user sees ONLY the numbers+bar on first entry, not spinner-then-numbers.
  const [show, setShow] = useState(
    () => sessionStorage.getItem(POST_LOGIN_FLAG) === "1"
  );

  // Consume the flag once so a later plain refresh won't replay it.
  useEffect(() => {
    sessionStorage.removeItem(POST_LOGIN_FLAG);
  }, []);

  // If the login didn't actually complete, drop the curtain.
  useEffect(() => {
    if (status === "unauthenticated" || status === "denied") setShow(false);
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
