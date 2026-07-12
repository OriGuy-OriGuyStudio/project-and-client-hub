import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import type { SocialLink } from "@/components/brand/social";
import type { BrandColor, BrandColorRole, ClientBrand, LogoFit } from "@/types/database";

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

// ---- org-centric brand resolution (Task 8: brand lives on the org, not on a
// single client_id — see docs/superpowers/specs/2026-07-12-org-centric-admin-design.md) ----

export interface OrgBrandBundle {
  brand: ClientBrand | null;
  colors: BrandColor[];
}

/**
 * Core fetch: an organization's single canonical brand row (`org_brand` RPC,
 * which reads `client_brand` where `org_id` matches and `is_org_primary`) plus
 * its color palette. Shared by every brand consumer that resolves brand by
 * organization instead of by a single client_id. Degrades to `{ brand: null,
 * colors: [] }` (never throws) when the org simply has no brand row yet, e.g.
 * the internal studio org.
 */
export async function fetchOrgBrand(orgId: string): Promise<OrgBrandBundle> {
  const { data: brand, error } = await supabase.rpc("org_brand", { p_org: orgId });
  if (error) throw error;
  if (!brand) return { brand: null, colors: [] };

  const { data: colors, error: colorsError } = await supabase
    .from("brand_colors")
    .select("*")
    .eq("client_id", brand.client_id)
    .order("sort_order", { ascending: true });
  if (colorsError) throw colorsError;

  return { brand, colors: colors ?? [] };
}

/** An organization's brand identity + palette (the business's single source of
 * brand truth). null/undefined orgId keeps the query disabled. */
export function useOrgBrand(orgId: string | null | undefined) {
  return useQuery({
    queryKey: ["org-brand", orgId],
    enabled: !!orgId,
    queryFn: () => fetchOrgBrand(orgId!),
  });
}

/**
 * A specific member's brand, resolved via THEIR organization rather than their
 * own client_id row — so any member of a business sees the same brand as
 * every other member. A member with no org yet (rare, pre-onboarding)
 * degrades to no brand instead of throwing.
 */
export async function fetchBrandForClient(clientId: string): Promise<OrgBrandBundle> {
  const { data: membership, error } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", clientId)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!membership?.org_id) return { brand: null, colors: [] };
  return fetchOrgBrand(membership.org_id);
}

/**
 * Resolves which `client_id` a brand WRITE should land on: the org's single
 * canonical (`is_org_primary`) row — never a second row for a non-primary
 * member. Falls back to the org's founding member (earliest to join) when the
 * org has no primary brand row yet (e.g. a business created after the
 * brand->org migration shipped), and to the given clientId itself when it has
 * no org at all (rare, legacy/pre-onboarding).
 */
export async function resolveOrgPrimaryClientId(
  clientId: string
): Promise<{ clientId: string; orgId: string | null }> {
  const { data: membership, error: memberError } = await supabase
    .from("organization_members")
    .select("org_id")
    .eq("user_id", clientId)
    .limit(1)
    .maybeSingle();
  if (memberError) throw memberError;
  const orgId = membership?.org_id ?? null;
  if (!orgId) return { clientId, orgId: null };

  const { data: primary, error: primaryError } = await supabase
    .from("client_brand")
    .select("client_id")
    .eq("org_id", orgId)
    .eq("is_org_primary", true)
    .maybeSingle();
  if (primaryError) throw primaryError;
  if (primary?.client_id) return { clientId: primary.client_id, orgId };

  const { data: founder, error: founderError } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("org_id", orgId)
    .order("created_at", { ascending: true })
    .order("user_id", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (founderError) throw founderError;
  return { clientId: founder?.user_id ?? clientId, orgId };
}

/**
 * Admin mutation: save a business's brand identity. Resolves the write target
 * to the org's single primary `client_brand` row (see
 * `resolveOrgPrimaryClientId` above) — so opening the editor from any member's
 * card always edits (and never duplicates) the one brand row for that
 * business — then upserts it and replaces the `brand_colors` set. Admin-only
 * at the DB level (RLS), so the replace is a simple delete-then-insert.
 * Invalidates the client/org detail + any brand-dependent project caches so
 * the Project page reflects the change.
 */
export function useSaveClientBrand(clientId: string | undefined) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: { brand: BrandFormValues; colors: ColorDraft[] }) => {
      if (!clientId) throw new Error("missing client id");
      const { brand, colors } = input;

      const target = await resolveOrgPrimaryClientId(clientId);

      const { error: brandErr } = await supabase.from("client_brand").upsert(
        {
          client_id: target.clientId,
          ...(target.orgId ? { org_id: target.orgId, is_org_primary: true } : {}),
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
        .eq("client_id", target.clientId);
      if (delErr) throw delErr;

      const rows = colors
        .filter((c) => c.hex_value.trim().length > 0)
        .map((c, i) => ({
          client_id: target.clientId,
          hex_value: c.hex_value.trim(),
          label: orNull(c.label),
          role: c.role,
          sort_order: i,
        }));

      if (rows.length > 0) {
        const { error: insErr } = await supabase.from("brand_colors").insert(rows);
        if (insErr) throw insErr;
      }

      return target;
    },
    onSuccess: (target) => {
      qc.invalidateQueries({ queryKey: ["client-detail", clientId] });
      if (target.orgId) qc.invalidateQueries({ queryKey: ["org-brand", target.orgId] });
      // Brand shows on the Project page (useProject / useProjects).
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({
        predicate: (q) => q.queryKey[0] === "project",
      });
    },
  });
}
