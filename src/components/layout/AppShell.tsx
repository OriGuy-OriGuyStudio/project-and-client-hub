import { useEffect, useRef } from "react";
import { Outlet } from "react-router-dom";
import gsap from "gsap";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";
import { toast } from "@/hooks/use-toast";

const GENDER_NOTE_KEY = "sog-gender-note";

/**
 * Authenticated app frame. On first mount it runs the GSAP load sequence:
 * sidebar slides in from the right (RTL), header fades down, content rises.
 */
export function AppShell() {
  const reduced = usePrefersReducedMotion();
  const sidebarRef = useRef<HTMLElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (reduced) return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power2.out" } });
      tl.from(sidebarRef.current, { x: 40, opacity: 0, duration: 0.4 })
        .from(headerRef.current, { y: -20, opacity: 0, duration: 0.3 }, "-=0.2")
        .from(mainRef.current, { y: 16, opacity: 0, duration: 0.35 }, "-=0.15");
    });
    return () => ctx.revert();
  }, [reduced]);

  // One-time note: copy is masculine grammatical form, addresses everyone.
  useEffect(() => {
    if (localStorage.getItem(GENDER_NOTE_KEY)) return;
    const t = setTimeout(() => {
      toast({
        title: "לתשומת לבך",
        description:
          "הטקסטים במערכת כתובים בלשון זכר מטעמי נוחות, ומיועדים לכל המגדרים.",
      });
      localStorage.setItem(GENDER_NOTE_KEY, "1");
    }, 1200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="flex min-h-screen w-full">
      <Sidebar ref={sidebarRef} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header ref={headerRef} />
        <main ref={mainRef} className="flex-1 overflow-x-hidden px-4 py-5 sm:px-6 sm:py-6">
          <div className="mx-auto w-full max-w-5xl">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
