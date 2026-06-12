import { useState } from "react";
import { ChevronDown, Globe, Palette, Type } from "lucide-react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Card } from "@/components/ui/card";
import { ColorSwatch } from "./ColorSwatch";
import { cn } from "@/lib/utils";
import type { BrandColor, ClientBrand } from "@/types/database";

/**
 * "זהות המותג" - read-only for clients, the source of brand truth on the
 * project page. Collapsible; defaults open when there's content to show.
 */
export function BrandGuidelines({
  brand,
  colors,
}: {
  brand: ClientBrand | null;
  colors: BrandColor[];
}) {
  const hasContent =
    !!brand?.business_description ||
    !!brand?.logo_url ||
    colors.length > 0 ||
    !!brand?.font_notes;
  const [open, setOpen] = useState(hasContent);

  const social = (brand?.social_links ?? {}) as Record<string, string>;
  const socialEntries = Object.entries(social).filter(([, v]) => !!v);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-5 text-start">
          <div className="flex items-center gap-2">
            <Palette className="size-5 text-brand-cyan-base" />
            <span className="font-heading text-lg font-semibold text-foreground">
              זהות המותג
            </span>
          </div>
          <ChevronDown
            className={cn(
              "size-5 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        </CollapsibleTrigger>

        <CollapsibleContent className="space-y-6 px-5 pb-6">
          {!hasContent ? (
            <p className="text-sm text-muted-foreground">
              עדיין לא הוגדרה זהות מותג לפרויקט זה.
            </p>
          ) : (
            <>
              {(brand?.logo_url || brand?.business_name) && (
                <div className="flex items-center gap-4">
                  {brand?.logo_url && (
                    <div className="flex items-center gap-3">
                      <img
                        src={brand.logo_url}
                        alt={brand.business_name ?? "לוגו"}
                        className="h-16 w-16 rounded-xl object-contain"
                      />
                      <img
                        src={brand.logo_icon_url || brand.logo_url}
                        alt=""
                        className="h-8 w-8 rounded-lg object-contain"
                      />
                    </div>
                  )}
                  {brand?.business_name && (
                    <h3 className="font-heading text-xl font-bold text-foreground">
                      {brand.business_name}
                    </h3>
                  )}
                </div>
              )}

              {brand?.business_description && (
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {brand.business_description}
                </p>
              )}

              {colors.length > 0 && (
                <div>
                  <p className="mb-3 text-sm font-medium text-foreground">
                    צבעי המותג
                  </p>
                  <div className="flex flex-wrap gap-5">
                    {colors.map((c) => (
                      <ColorSwatch key={c.id} color={c} />
                    ))}
                  </div>
                </div>
              )}

              {brand?.font_notes && (
                <div className="flex items-start gap-2 text-sm text-muted-foreground">
                  <Type className="mt-0.5 size-4 shrink-0 text-brand-cyan-base" />
                  <span>{brand.font_notes}</span>
                </div>
              )}

              {(brand?.website_url || socialEntries.length > 0) && (
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  {brand?.website_url && (
                    <a
                      href={brand.website_url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex items-center gap-1 text-link hover:underline"
                    >
                      <Globe className="size-4" />
                      אתר
                    </a>
                  )}
                  {socialEntries.map(([key, url]) => (
                    <a
                      key={key}
                      href={url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-link hover:underline"
                    >
                      {key}
                    </a>
                  ))}
                </div>
              )}
            </>
          )}
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
