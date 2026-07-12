import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Building2, FolderKanban, Globe, Palette, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { SectionNav } from "@/components/layout/SectionNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ColorSwatch } from "@/components/brand/ColorSwatch";
import { BrandIdentityEditor } from "@/components/brand/BrandIdentityEditor";
import {
  iconForPlatform,
  labelForPlatform,
  normalizeSocialLinks,
} from "@/components/brand/social";
import { OrgMembersSection } from "@/components/admin/OrgMembersSection";
import { useOrgFounder, useOrgProjects, useAdminOrgMembers } from "@/hooks/useOrg";
import { useClientDetail } from "@/hooks/useClientDetail";
import { supabase } from "@/lib/supabase";
import { projectStatusHe, projectStatusVariant } from "@/lib/status";
import { Field, genderHe } from "@/pages/admin/ClientDetail";
import type { Organization } from "@/types/database";

/** The organization row itself (name/kind), for the page header. Admin RLS
 * (`organizations_admin_all`) permits reading any org directly. */
function useOrgHeader(orgId: string | undefined) {
  return useQuery({
    queryKey: ["org-header", orgId],
    enabled: !!orgId,
    queryFn: async (): Promise<Organization | null> => {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", orgId!)
        .maybeSingle();
      if (error) throw error;
      return data ?? null;
    },
  });
}

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string | number }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-sm">{label}</span>
      </div>
      <p className="mt-1 font-heading text-2xl font-black text-foreground">{value}</p>
    </Card>
  );
}

/**
 * Admin: a single business's ("organization") detail page - members, projects,
 * brand identity, and (for now) the founding member's CRM note.
 *
 * Brand identity is resolved by ORGANIZATION (Task 8: `useClientDetail` reads
 * `client_brand` via the org's single primary row, not this member's own
 * client_id), so it's the same brand regardless of which member is queried.
 *
 * KNOWN LIMITATION (see docs/superpowers/specs/2026-07-12-org-centric-admin-design.md):
 * the CRM note is still keyed on one member (the org's founder - the earliest
 * to join) rather than the org itself, so this page reads/edits it via that
 * member's client_id until a later task migrates `admin_client_notes` to be
 * org-scoped.
 */
export default function BusinessDetail() {
  const { orgId } = useParams();
  const { data: org, isLoading: orgLoading } = useOrgHeader(orgId);
  const { data: founder, isLoading: founderLoading } = useOrgFounder(orgId);
  const { data: members } = useAdminOrgMembers(orgId);
  const { data: orgProjects, isLoading: projectsLoading } = useOrgProjects(orgId);
  // Brand resolves via the org (see file header); the CRM note is still
  // founder-keyed - see the KNOWN LIMITATION note above.
  const { data: founderDetail, isLoading: founderDetailLoading } = useClientDetail(founder?.user_id);

  // project.client_id -> the member's display name, for the "responsible
  // contact" column (read-only for now; the reassign picker is a later task).
  const memberNameByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of members ?? []) {
      if (m.user_id) map.set(m.user_id, m.full_name);
    }
    return map;
  }, [members]);

  if (orgLoading || founderLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (!org) {
    return <EmptyState icon={Building2} title="העסק לא נמצא" />;
  }

  const brand = founderDetail?.brand ?? null;
  const colors = founderDetail?.colors ?? [];
  const note = founderDetail?.note ?? null;
  const profile = founderDetail?.profile ?? null;

  const hasBrand =
    !!brand?.logo_url ||
    !!brand?.business_name ||
    !!brand?.business_description ||
    colors.length > 0 ||
    !!brand?.website_url ||
    normalizeSocialLinks(brand?.social_links).length > 0;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
        <Link to="/admin/businesses">
          <ArrowRight className="size-4" /> לכל העסקים
        </Link>
      </Button>

      <PageHeader
        title={brand?.business_name || org.name}
        subtitle={profile?.full_name ? `בעל/ת החשבון: ${profile.full_name}` : undefined}
        actions={
          founder ? (
            <Button variant="secondary" size="sm" asChild>
              <Link to={`/admin/clients/${founder.user_id}`}>כרטיס הלקוח המייסד</Link>
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat icon={FolderKanban} label="פרויקטים" value={orgProjects?.length ?? 0} />
        <Stat icon={Users} label="חברי צוות" value={members?.length ?? 0} />
      </div>

      <SectionNav />

      {founder ? (
        <>
          {/* Contact + CRM (founder-keyed - known limitation, see file header) */}
          <Card id="bd-details" data-section className="scroll-mt-20 space-y-3 p-5">
            <h2 className="font-heading text-lg font-semibold text-foreground">פרטים ומידע אישי</h2>
            {founderDetailLoading ? (
              <Skeleton className="h-16 w-full rounded-xl" />
            ) : (
              <>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <Field label="אימייל" value={profile?.email || "-"} mono copyable />
                  <Field label="טלפון" value={profile?.phone || "-"} mono copyable />
                  <Field label="מין" value={note?.gender ? genderHe[note.gender] : "-"} />
                  <Field label="תפקיד בחברה" value={note?.role_in_company || "-"} />
                </dl>
                {note?.content && (
                  <div>
                    <p className="text-sm font-medium text-foreground">מידע אישי</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{note.content}</p>
                  </div>
                )}
              </>
            )}
          </Card>

          {/* Team + access (members, caps, presets, pending, invite requests) */}
          <OrgMembersSection clientId={founder.user_id} />

          {/* Brand identity (org-resolved - see file header) */}
          <Card id="bd-brand" data-section className="scroll-mt-20 space-y-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
                <Palette className="size-5 text-brand-cyan-base" />
                זהות מותג
              </h2>
              <BrandIdentityEditor clientId={founder.user_id} brand={brand} colors={colors} />
            </div>

            {founderDetailLoading ? (
              <Skeleton className="h-16 w-full rounded-xl" />
            ) : !hasBrand ? (
              <p className="text-sm text-muted-foreground">
                עדיין לא הוגדרה זהות מותג. לחץ על "עריכת זהות מותג" כדי להתחיל.
              </p>
            ) : (
              <div className="space-y-4">
                {(brand?.logo_url || brand?.business_name) && (
                  <div className="flex items-center gap-3">
                    {brand?.logo_url && (
                      <img
                        src={brand.logo_url}
                        alt={brand.business_name ?? "לוגו"}
                        className="h-14 w-14 rounded-xl object-contain"
                      />
                    )}
                    {brand?.business_name && (
                      <p className="font-heading text-lg font-bold text-foreground">
                        {brand.business_name}
                      </p>
                    )}
                  </div>
                )}
                {brand?.business_description && (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {brand.business_description}
                  </p>
                )}
                {colors.length > 0 && (
                  <div className="flex flex-wrap gap-5">
                    {colors.map((c) => (
                      <ColorSwatch key={c.id} color={c} />
                    ))}
                  </div>
                )}
                {(() => {
                  const socialEntries = normalizeSocialLinks(brand?.social_links);
                  if (!brand?.website_url && socialEntries.length === 0) return null;
                  return (
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
                      {socialEntries.map((s, i) => {
                        const Icon = iconForPlatform(s.platform);
                        return (
                          <a
                            key={`${s.platform}-${i}`}
                            href={s.url}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="flex items-center gap-1 text-link hover:underline"
                          >
                            <Icon className="size-4" />
                            {labelForPlatform(s.platform)}
                          </a>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}
          </Card>
        </>
      ) : (
        <EmptyState
          icon={Users}
          title="אין עדיין חברי צוות עם גישה"
          description="המנהל/ת שהוזמן/ה עדיין לא התחבר/ה בפעם הראשונה, כך שאין עדיין צוות, מותג או מידע אישי להצגה."
        />
      )}

      {/* Projects (org-wide, read-only for now - the reassign picker is a later task) */}
      <Card id="bd-projects" data-section className="scroll-mt-20 space-y-3 p-5">
        <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
          <FolderKanban className="size-5 text-muted-foreground" /> הפרויקטים של העסק
        </h2>
        {projectsLoading ? (
          <Skeleton className="h-20 w-full rounded-xl" />
        ) : !orgProjects?.length ? (
          <EmptyState icon={FolderKanban} title="אין עדיין פרויקטים" />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-muted-foreground">
                  <th className="px-3 py-2 text-start font-medium">פרויקט</th>
                  <th className="px-3 py-2 text-start font-medium">סטטוס</th>
                  <th className="px-3 py-2 text-start font-medium">איש קשר אחראי</th>
                  <th className="px-3 py-2 text-start font-medium">עודכן</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {orgProjects.map((p) => (
                  <tr key={p.id} className="text-foreground">
                    <td className="px-3 py-2.5">
                      <Link to={`/projects/${p.id}`} className="font-medium hover:text-primary hover:underline">
                        {p.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={projectStatusVariant[p.status]}>{projectStatusHe[p.status]}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {memberNameByUserId.get(p.client_id) ?? "-"}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground">
                      {new Date(p.updated_at).toLocaleDateString("he-IL")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
