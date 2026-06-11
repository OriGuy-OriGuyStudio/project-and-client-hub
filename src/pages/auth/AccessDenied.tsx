import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export default function AccessDenied() {
  const { signOut, user } = useAuth();

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="flex max-w-md flex-col items-center gap-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-destructive/15 text-destructive">
          <ShieldAlert className="size-8" />
        </div>

        <div className="space-y-2">
          <h1 className="font-heading text-2xl font-black text-foreground">
            עדיין אין לך גישה
          </h1>
          <p className="mx-auto max-w-sm text-muted-foreground">
            הגישה שמורה ללקוחות שלי. אם לדעתך זו טעות, שלח לי הודעה ואני אפתח לך
            גישה.
          </p>
          {user?.email && (
            <p className="font-mono-code text-xs text-muted-foreground">
              {user.email}
            </p>
          )}
        </div>

        <Button variant="secondary" onClick={() => signOut()}>
          התנתקות
        </Button>
      </div>
    </main>
  );
}
