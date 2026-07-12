import { forwardRef, Fragment } from "react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { adminNav, clientNav, partnerNav } from "./nav-config";
import { useAuth } from "@/hooks/useAuth";
import { useMyEnrollment } from "@/hooks/useMyEnrollment";
import { useNotifications } from "@/hooks/useNotifications";

/**
 * The nav list itself (logo + links + footer). Shared by the desktop sidebar
 * and the mobile drawer; `onNavigate` lets the drawer close on link click.
 */
export function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { isAdmin, isPartner } = useAuth();
  const isClient = !isAdmin && !isPartner;
  const { data: enrolled } = useMyEnrollment(isClient);
  const { items: notifs } = useNotifications();

  let items = isAdmin ? adminNav : isPartner ? partnerNav : clientNav;
  if (isClient && !enrolled) {
    items = items.filter((i) => i.to !== "/partner");
  }

  const badgeFor = (types?: string[]) =>
    types ? notifs.filter((n) => !n.is_read && types.includes(n.type)).length : 0;

  return (
    <>
      <div className="flex h-16 items-center gap-2 px-6">
        <img src="/brand/logo-mark.svg" alt="" className="size-8 shrink-0" />
        <span className="font-heading text-base font-bold text-foreground">
          Ori Guy Studio
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
        {items.map((item, i) => {
          // Render a small group heading whenever the section changes (admin
          // nav only; client/partner items have no section, so no headings).
          const showHeading = !!item.section && item.section !== items[i - 1]?.section;
          return (
            <Fragment key={item.to}>
              {showHeading && (
                <p
                  className={cn(
                    "px-3 pb-1 pt-4 text-[11px] font-semibold tracking-wide text-muted-foreground/50",
                    i === 0 && "pt-0"
                  )}
                >
                  {item.section}
                </p>
              )}
              <NavLink
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                data-tour={item.tourId}
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
            </Fragment>
          );
        })}
      </nav>

      <div className="px-6 py-4">
        <p className="text-[11px] text-muted-foreground/70">
          {isAdmin ? "מצב אדמין" : isPartner ? "פורטל שותפים" : "פורטל לקוח"}
        </p>
      </div>
    </>
  );
}

/**
 * Right-anchored RTL sidebar (desktop only). The ref is forwarded so the
 * AppShell's GSAP load timeline can slide it in from the right. On mobile it's
 * hidden - navigation moves into the MobileNav drawer (see the Header).
 */
export const Sidebar = forwardRef<HTMLElement>((_props, ref) => {
  return (
    <aside
      ref={ref}
      data-tour="nav"
      className="hidden w-64 shrink-0 flex-col border-l border-border bg-sidebar md:flex"
    >
      <SidebarContent />
    </aside>
  );
});
Sidebar.displayName = "Sidebar";
