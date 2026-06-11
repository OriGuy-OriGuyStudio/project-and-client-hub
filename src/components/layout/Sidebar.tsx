import { forwardRef } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { adminNav, clientNav, partnerNav } from "./nav-config";
import { useAuth } from "@/hooks/useAuth";
import { useMyEnrollment } from "@/hooks/useMyEnrollment";
import { useNotifications } from "@/hooks/useNotifications";

/**
 * Right-anchored RTL sidebar. The ref is forwarded so the AppShell's GSAP
 * load timeline can slide it in from the right.
 */
export const Sidebar = forwardRef<HTMLElement>((_props, ref) => {
  const { isAdmin, isPartner } = useAuth();
  const isClient = !isAdmin && !isPartner;
  const { data: enrolled } = useMyEnrollment(isClient);

  const { items: notifs } = useNotifications();

  let items = isAdmin ? adminNav : isPartner ? partnerNav : clientNav;
  // The referral program only appears for clients the admin has approved.
  if (isClient && !enrolled) {
    items = items.filter((i) => i.to !== "/partner");
  }

  const badgeFor = (types?: string[]) =>
    types ? notifs.filter((n) => !n.is_read && types.includes(n.type)).length : 0;

  return (
    <aside
      ref={ref}
      className="hidden w-64 shrink-0 flex-col border-l border-border bg-sidebar md:flex"
    >
      <div className="flex h-16 items-center gap-2 px-6">
        <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-extrabold text-primary-foreground">
          OG
        </div>
        <span className="font-heading text-base font-bold text-foreground">
          Studio Ori Guy
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:bg-card hover:text-foreground"
              )
            }
          >
            <item.icon className="size-5" />
            <span className="flex-1">{item.label}</span>
            {badgeFor(item.badgeTypes) > 0 && (
              <span className="flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[11px] font-bold text-destructive-foreground">
                {badgeFor(item.badgeTypes)}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="px-6 py-4">
        <p className="font-mono-code text-[10px] text-muted-foreground/70">
          {isAdmin ? "מצב אדמין" : isPartner ? "פורטל שותפים" : "פורטל לקוח"}
        </p>
      </div>
    </aside>
  );
});
Sidebar.displayName = "Sidebar";
