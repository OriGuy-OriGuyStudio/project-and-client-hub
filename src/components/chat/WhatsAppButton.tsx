import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const WHATSAPP = import.meta.env.VITE_STUDIO_WHATSAPP;

/** Deep-links to WhatsApp pre-filled with the project context. */
export function WhatsAppButton({ projectTitle }: { projectTitle: string }) {
  if (!WHATSAPP) return null;
  const text = encodeURIComponent(`שלום, בקשר לפרויקט: ${projectTitle}`);
  const href = `https://wa.me/${WHATSAPP}?text=${text}`;
  return (
    <Button variant="secondary" size="sm" asChild>
      <a href={href} target="_blank" rel="noreferrer noopener">
        <MessageCircle className="size-4 text-brand-green-base" />
        וואטסאפ
      </a>
    </Button>
  );
}
