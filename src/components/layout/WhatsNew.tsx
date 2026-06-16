import { useEffect, useState } from "react";
import { Check, Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { whenUiIsClear } from "@/components/help/tour";
import {
  clientWhatsNew,
  partnerWhatsNew,
  CLIENT_TOUR_VERSION,
  PARTNER_TOUR_VERSION,
  type WhatsNewEntry,
} from "@/components/help/help-content";

const CONFIG = {
  client: {
    seenKey: (uid: string) => `sog-tour-${uid}`,
    verKey: (uid: string) => `sog-tour-ver-${uid}`,
    version: CLIENT_TOUR_VERSION,
    entries: clientWhatsNew,
  },
  partner: {
    seenKey: (uid: string) => `sog-partner-tour-${uid}`,
    verKey: (uid: string) => `sog-partner-tour-ver-${uid}`,
    version: PARTNER_TOUR_VERSION,
    entries: partnerWhatsNew,
  },
} as const;

/**
 * Shown to RETURNING client/partner users on login: a short "what's new" modal
 * listing only the updates added since the version they last saw. Brand-new
 * users get the full driver.js tour instead (handled in the dashboards). Waits
 * for the loader + any other popup (gift/redemption) to clear before opening.
 */
export function WhatsNew({ audience }: { audience: "client" | "partner" }) {
  const { user } = useAuth();
  const cfg = CONFIG[audience];
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<WhatsNewEntry[]>([]);

  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;
    // Brand-new users get the full tour (which also stamps the version); skip.
    const firstTime = !localStorage.getItem(cfg.seenKey(uid));
    if (firstTime) return;
    const seenVer = Number(localStorage.getItem(cfg.verKey(uid)) ?? "1");
    if (seenVer >= cfg.version) return;
    const fresh = cfg.entries.filter((e) => e.version > seenVer);
    if (!fresh.length) {
      localStorage.setItem(cfg.verKey(uid), String(cfg.version));
      return;
    }
    setItems(fresh);
    return whenUiIsClear(() => setOpen(true));
  }, [user?.id, cfg]);

  function dismiss() {
    const uid = user?.id;
    if (uid) localStorage.setItem(cfg.verKey(uid), String(cfg.version));
    setOpen(false);
  }

  if (!open || !items.length) return null;

  return (
    <Dialog open onOpenChange={(o) => !o && dismiss()}>
      <DialogContent className="max-w-sm">
        <div className="grid size-12 place-items-center rounded-2xl bg-primary/15 text-primary">
          <Sparkles className="size-6" />
        </div>
        <DialogHeader>
          <DialogTitle className="font-heading text-xl">מה חדש?</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {items.map((e) => (
            <div key={e.version} className="space-y-2">
              <p className="font-medium text-foreground">{e.title}</p>
              <ul className="space-y-1.5">
                {e.items.map((it, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                    <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button className="w-full" onClick={dismiss}>
            הבנתי, תודה!
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
