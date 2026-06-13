import { useState } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Bot, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/hooks/usePrefersReducedMotion";

const AI_CHAT_URL = import.meta.env.VITE_AI_CHAT_URL;

// Public/auth screens have no signed-in client — keep the assistant out of them.
const HIDE_ON = ["/login", "/admin/login", "/partner-portal/login", "/access-denied"];

/**
 * Persistent floating AI assistant. Mounted once at the app root, OUTSIDE the
 * router outlet, so it survives navigation. The panel is a standalone iframe -
 * no portal data is passed into it. RTL: anchored bottom-left.
 */
export function AIWidget() {
  const [open, setOpen] = useState(false);
  const reduced = usePrefersReducedMotion();
  const { pathname } = useLocation();

  if (!AI_CHAT_URL || HIDE_ON.includes(pathname)) return null;

  return (
    <div className="fixed bottom-5 left-5 z-[9999] flex flex-col items-start gap-3">
      <AnimatePresence>
        {open && (
          <motion.div
            key="ai-panel"
            initial={reduced ? false : { opacity: 0, y: 16, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduced ? undefined : { opacity: 0, y: 16, scale: 0.96 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className={cn(
              "overflow-hidden rounded-2xl border border-brand-cyan-base/30 bg-card shadow-2xl",
              "h-[600px] w-[400px] max-w-[calc(100vw-2.5rem)]",
              "max-md:fixed max-md:inset-0 max-md:h-[100dvh] max-md:w-screen max-md:max-w-none max-md:rounded-none"
            )}
          >
            <div className="flex items-center justify-between border-b border-border bg-gradient-to-l from-brand-cyan-base/15 to-brand-green-base/10 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-lg bg-brand-cyan-base/20 text-brand-cyan-base">
                  <Bot className="size-4" />
                </span>
                <span className="font-heading text-sm font-semibold text-foreground">
                  עוזר ה-AI של הסטודיו
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-muted-foreground transition hover:text-foreground"
                aria-label="סגירת הצ'אט"
              >
                <X className="size-5" />
              </button>
            </div>
            <iframe
              src={AI_CHAT_URL}
              title="עוזר ה-AI של הסטודיו"
              className="h-[calc(100%-3.25rem)] w-full border-0 bg-white"
              sandbox="allow-scripts allow-forms allow-same-origin allow-popups"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {!open && (
        <motion.button
          initial={false}
          whileHover={reduced ? undefined : { scale: 1.05 }}
          whileTap={reduced ? undefined : { scale: 0.95 }}
          onClick={() => setOpen(true)}
          className="flex size-12 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lift transition-colors duration-300 ease-soft hover:bg-primary hover:text-primary-foreground"
          aria-label="פתיחת עוזר ה-AI"
        >
          <Bot className="size-5" />
        </motion.button>
      )}
    </div>
  );
}
