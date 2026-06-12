import { Card } from "@/components/ui/card";
import { FancyButton } from "@/components/ui/fancy-button";

const WHATSAPP = import.meta.env.VITE_STUDIO_WHATSAPP;

/**
 * Friendly "reach the studio" CTA shown on the client & partner dashboards.
 * Deep-links to WhatsApp with the brand FancyButton.
 */
export function StudioContactCta() {
  if (!WHATSAPP) return null;
  const href = `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(
    "היי אורי, רציתי לשאול לגבי..."
  )}`;

  return (
    <Card className="flex flex-col items-center gap-4 p-6 text-center sm:flex-row sm:justify-between sm:text-start">
      <div className="space-y-1">
        <h3 className="font-heading text-base font-semibold text-foreground">
          צריך משהו? אני כאן.
        </h3>
        <p className="text-sm text-muted-foreground">
          שאלה, עדכון או רעיון - שלחו לי הודעה ונדבר.
        </p>
      </div>
      <FancyButton
        label="דברו איתי"
        href={href}
        target="_blank"
        rel="noreferrer noopener"
      />
    </Card>
  );
}
