import { useState } from "react";
import { ExternalLink, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HeroPill } from "@/components/ui/hero-pill";
import { useActiveAnnouncements, useDismissAnnouncement } from "@/hooks/useAnnouncements";
import type { Announcement } from "@/types/database";

/**
 * Dashboard banner for admin-posted announcements ("what's new" / a page was
 * updated). Renders each active, not-yet-dismissed announcement as a HeroPill;
 * clicking opens a detail modal with the full write-up and an optional CTA
 * link. The × dismisses it permanently for this user. Audience targeting is
 * enforced by RLS, so this single component serves both clients and partners.
 */
export function AnnouncementBanner() {
  const { data: items } = useActiveAnnouncements();
  const dismiss = useDismissAnnouncement();
  const [open, setOpen] = useState<Announcement | null>(null);

  if (!items || items.length === 0) return null;

  return (
    <>
      <div className="mb-6 flex flex-col items-start gap-2">
        {items.map((a) => (
          <div key={a.id} className="flex items-center gap-1.5">
            <HeroPill announcement={a.badge} label={a.title} onClick={() => setOpen(a)} />
            <button
              type="button"
              onClick={() => dismiss.mutate(a.id)}
              aria-label="הסתרת ההכרזה"
              className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
      </div>

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-sm">
          {open && (
            <>
              <div className="w-fit rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
                {open.badge}
              </div>
              <DialogHeader>
                <DialogTitle className="font-heading text-xl">{open.title}</DialogTitle>
              </DialogHeader>
              {open.body && (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                  {open.body}
                </p>
              )}
              <DialogFooter className="gap-2 sm:gap-2">
                {open.link_url && (
                  <Button asChild className="w-full">
                    <a
                      href={open.link_url}
                      target={open.is_external ? "_blank" : undefined}
                      rel={open.is_external ? "noopener noreferrer" : undefined}
                    >
                      {open.link_label || "מעבר"}
                      {open.is_external && <ExternalLink className="size-4" />}
                    </a>
                  </Button>
                )}
                <Button
                  variant={open.link_url ? "secondary" : "default"}
                  className="w-full"
                  onClick={() => {
                    dismiss.mutate(open.id);
                    setOpen(null);
                  }}
                >
                  הבנתי, אל תציגו שוב
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
