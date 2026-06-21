import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { SocialLink } from "@/components/brand/social";
import type { BrandColorRole, LogoFit } from "@/types/database";

/** Editable brand-identity fields (the `client_brand` row, minus ids/timestamps). */
export interface BrandFormValues {
  business_name: string;
  business_description: string;
  logo_url: string;
  logo_icon_url: string;
  font_notes: string;
  website_url: string;
  social_links: SocialLink[];
  logo_fit: LogoFit;
}

/** A single palette row being edited (no id — colors are replaced as a set). */
export interface ColorDraft {
  hex_value: string;
  label: string;
  role: BrandColorRole | null;
}

const orNull = (s: string) => {
  const t = s.trim();
  return t.length ? t : null;
};

/**
 * Admin mutation: save a client's brand identity. Upserts the single
 * `client_brand` row (unique on client_id) and replaces the `brand_colors`
 * set. Admin-only at the DB level (RLS), so the replace is a simple
 * delete-then-insert. Invalidates the client detail + any brand-dependent
 * project caches so the Project page reflects the change.
 */
export function useSaveClientBrand(clientId: string | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { brand: BrandFormValues; colors: ColorDraft[] }) => {
      if (!clientId) throw new Error("missing client id");
      const { brand, colors } = input;

      const { error: brandErr } = await supabase.from("client_brand").upsert(
        {
          client_id: clientId,
          business_name: orNull(brand.business_name),
          business_description: orNull(brand.business_description),
          logo_url: orNull(brand.logo_url),
          logo_icon_url: orNull(brand.logo_icon_url),
          font_notes: orNull(brand.font_notes),
          website_url: orNull(brand.website_url),
          social_links: brand.social_links
            .map((s) => ({ platform: s.platform, url: s.url.trim() }))
            .filter((s) => s.url.length > 0),
          logo_fit: brand.logo_fit,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "client_id" }
      );
      if (brandErr) throw brandErr;

      // Replace the palette: drop the old set, insert the new (ordered) one.
      const { error: delErr } = await supabase
        .from("brand_colors")
        .delete()
        .eq("client_id", clientId);
      if (delErr) throw delErr;

      const rows = colors
        .filter((c) => c.hex_value.trim().length > 0)
        .map((c, i) => ({
          client_id: clientId,
          hex_value: c.hex_value.trim(),
          label: orNull(c.label),
          role: c.role,
          sort_order: i,
        }));

      if (rows.length > 0) {
        const { error: insErr } = await supabase.from("brand_colors").insert(rows);
        if (insErr) throw insErr;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-detail", clientId] });
      // Brand shows on the Project page (useProject / useProjects).
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({
        predicate: (q) => q.queryKey[0] === "project",
      });
    },
  });
}
