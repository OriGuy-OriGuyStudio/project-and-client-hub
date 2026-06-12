import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarContent } from "./Sidebar";

/**
 * Mobile navigation: a hamburger in the header that opens the sidebar nav as a
 * slide-in drawer from the inline-start (right, RTL). Hidden at `md` and up,
 * where the persistent Sidebar takes over.
 */
export function MobileNav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Close on navigation and lock body scroll while open.
  useEffect(() => setOpen(false), [location.pathname]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="תפריט"
        onClick={() => setOpen(true)}
      >
        <Menu className="size-5" />
      </Button>

      {open &&
        createPortal(
          // Portaled to <body> so the Header's backdrop-filter (which makes it a
          // containing block for fixed descendants) doesn't trap this drawer.
          <div className="fixed inset-0 z-[60] md:hidden">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <aside className="absolute inset-y-0 right-0 flex w-72 max-w-[80vw] flex-col border-l border-border bg-sidebar shadow-2xl animate-in slide-in-from-right duration-300">
              <div className="flex justify-end p-3">
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="סגירה"
                  onClick={() => setOpen(false)}
                >
                  <X className="size-5" />
                </Button>
              </div>
              <SidebarContent onNavigate={() => setOpen(false)} />
            </aside>
          </div>,
          document.body
        )}
    </>
  );
}
