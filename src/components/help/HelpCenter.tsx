import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { HelpCircle, Sparkles, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { helpSections, faq, partnerHelpSections, partnerFaq } from "./help-content";
import { startClientTour, startPartnerTour } from "./tour";

/**
 * Help center: a "?" button in the header that opens a right-side panel
 * explaining every part of the system, an FAQ, and a "replay the tour" button.
 */
export function HelpCenter() {
  const [open, setOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const { profile } = useAuth();
  const isPartner = profile?.role === "partner";
  const sections = isPartner ? partnerHelpSections : helpSections;
  const faqItems = isPartner ? partnerFaq : faq;
  const startTour = isPartner ? startPartnerTour : startClientTour;

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
        aria-label="עזרה"
        data-tour="help"
        onClick={() => setOpen(true)}
      >
        <HelpCircle className="size-5" />
      </Button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[60]">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setOpen(false)}
            />
            <aside className="absolute inset-y-0 right-0 flex w-96 max-w-[90vw] flex-col border-l border-border bg-card shadow-2xl animate-in slide-in-from-right duration-300">
              <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
                <h2 className="font-heading text-lg font-bold text-foreground">מרכז עזרה</h2>
                <Button variant="ghost" size="icon" aria-label="סגירה" onClick={() => setOpen(false)}>
                  <X className="size-5" />
                </Button>
              </div>

              <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
                <Button
                  className="w-full"
                  onClick={() => {
                    setOpen(false);
                    setTimeout(startTour, 250);
                  }}
                >
                  <Sparkles className="size-4" /> התחל הדרכה מודרכת
                </Button>

                <section className="space-y-3">
                  <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-muted-foreground">
                    מה כל חלק עושה
                  </h3>
                  <div className="space-y-2">
                    {sections.map((s) => (
                      <div
                        key={s.title}
                        className="rounded-xl border border-border bg-field p-3"
                      >
                        <p className="text-sm font-semibold text-foreground">{s.title}</p>
                        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                          {s.body}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="space-y-3">
                  <h3 className="font-heading text-sm font-bold uppercase tracking-wide text-muted-foreground">
                    שאלות נפוצות
                  </h3>
                  <div className="space-y-2">
                    {faqItems.map((item, i) => {
                      const isOpen = openFaq === i;
                      return (
                        <div key={i} className="rounded-xl border border-border">
                          <button
                            type="button"
                            onClick={() => setOpenFaq(isOpen ? null : i)}
                            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-start"
                          >
                            <span className="text-sm font-medium text-foreground">{item.q}</span>
                            <ChevronDown
                              className={cn(
                                "size-4 shrink-0 text-muted-foreground transition-transform",
                                isOpen && "rotate-180"
                              )}
                            />
                          </button>
                          {isOpen && (
                            <p className="px-3 pb-3 text-sm leading-relaxed text-muted-foreground">
                              {item.a}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            </aside>
          </div>,
          document.body
        )}
    </>
  );
}
