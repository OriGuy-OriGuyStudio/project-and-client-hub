import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { signOut as doSignOut } from "@/lib/auth";
import type { Profile } from "@/types/database";

type AuthStatus = "loading" | "unauthenticated" | "denied" | "authenticated";

interface AuthContextValue {
  status: AuthStatus;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isAdmin: boolean;
  isPartner: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const IDLE_LIMIT_MS = 24 * 60 * 60 * 1000; // 24h inactivity -> sign out

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");
  const lastActivity = useRef<number>(Date.now());

  // Resolve the profile for a session. A whitelisted user has a profiles row
  // (created by the signup trigger); an unknown Google account does not -> denied.
  async function resolveProfile(currentSession: Session | null) {
    if (!currentSession) {
      setProfile(null);
      setStatus("unauthenticated");
      return;
    }
    let { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentSession.user.id)
      .maybeSingle();

    // Self-heal: a whitelisted user who has no profile yet (e.g. signed in
    // before being whitelisted) gets one created on the spot, then we re-fetch.
    if (!error && !data) {
      const { data: role } = await supabase.rpc("ensure_my_profile");
      if (role) {
        ({ data, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", currentSession.user.id)
          .maybeSingle());
      }
    }

    if (error || !data) {
      setProfile(null);
      setStatus("denied");
      return;
    }
    setProfile(data);
    setStatus("authenticated");
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      resolveProfile(data.session);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!mounted) return;
      lastActivity.current = Date.now();
      setSession(next);
      setStatus("loading");
      resolveProfile(next);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Idle-timeout: sign the user out after 24h of no interaction.
  useEffect(() => {
    if (status !== "authenticated") return;
    const bump = () => (lastActivity.current = Date.now());
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }));

    const interval = window.setInterval(() => {
      if (Date.now() - lastActivity.current > IDLE_LIMIT_MS) {
        doSignOut();
      }
    }, 60_000);

    return () => {
      events.forEach((e) => window.removeEventListener(e, bump));
      window.clearInterval(interval);
    };
  }, [status]);

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      session,
      user: session?.user ?? null,
      profile,
      isAdmin: profile?.role === "admin",
      isPartner: profile?.role === "partner",
      signOut: doSignOut,
    }),
    [status, session, profile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
