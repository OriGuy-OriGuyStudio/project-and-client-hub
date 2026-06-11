import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const navigate = useNavigate();
  const { items, unread, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function onItemClick(id: string, link: string | null) {
    markRead(id);
    setOpen(false);
    if (link) navigate(link);
  }

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon"
        aria-label="התראות"
        onClick={() => setOpen((v) => !v)}
        className="relative"
      >
        <Bell className="size-5" />
        {unread > 0 && (
          <span className="absolute -end-0.5 -top-0.5 flex min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute end-0 top-12 z-50 w-80 overflow-hidden rounded-2xl border border-border bg-popover shadow-2xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
            <span className="font-heading text-sm font-bold text-foreground">התראות</span>
            {unread > 0 && (
              <button
                onClick={() => markAllRead()}
                className="flex items-center gap-1 text-xs text-link hover:underline"
              >
                <CheckCheck className="size-3.5" /> סמן הכל כנקרא
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                אין התראות חדשות
              </p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => onItemClick(n.id, n.link)}
                  className={cn(
                    "flex w-full flex-col gap-0.5 border-b border-border/60 px-4 py-3 text-start transition-colors hover:bg-card",
                    !n.is_read && "bg-primary/5"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {!n.is_read && <span className="size-2 shrink-0 rounded-full bg-primary" />}
                    <span className="text-sm font-medium text-foreground">{n.title}</span>
                  </div>
                  {n.body && (
                    <span className="truncate ps-4 text-xs text-muted-foreground">{n.body}</span>
                  )}
                  <span className="ps-4 text-[11px] text-muted-foreground/70">
                    {new Date(n.created_at).toLocaleString("he-IL")}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
