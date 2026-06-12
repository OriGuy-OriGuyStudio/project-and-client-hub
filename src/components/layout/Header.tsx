import { forwardRef } from "react";
import { LogOut } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { NotificationBell } from "./NotificationBell";
import { MobileNav } from "./MobileNav";
import { HelpCenter } from "@/components/help/HelpCenter";
import { useAuth } from "@/hooks/useAuth";

function initials(name?: string | null, email?: string | null) {
  const src = name?.trim() || email || "";
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (src[0] || "?").toUpperCase();
}

export const Header = forwardRef<HTMLElement>((_props, ref) => {
  const { profile, user, signOut } = useAuth();

  return (
    <header
      ref={ref}
      className="relative z-40 flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border bg-background/80 px-4 backdrop-blur sm:px-6"
    >
      <div className="flex min-w-0 items-center gap-3">
        <MobileNav />
        <Avatar>
          <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
          <AvatarFallback>
            {initials(profile?.full_name, user?.email)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 leading-tight">
          <p className="truncate text-sm font-medium text-foreground">
            {profile?.full_name || "ללא שם"}
          </p>
          <p className="truncate font-mono-code text-xs text-muted-foreground">
            {user?.email}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <HelpCenter />
        <ThemeToggle />
        <NotificationBell />
        <Button
          variant="ghost"
          size="icon"
          aria-label="התנתקות"
          onClick={() => signOut()}
        >
          <LogOut className="size-5" />
        </Button>
      </div>
    </header>
  );
});
Header.displayName = "Header";
