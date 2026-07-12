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
import {
  useOrgFounder,
  useOrgProjects,
  useAdminOrgMembers,
  useOrgNotes,
  useOrgCallLogs,
} from "@/hooks/useOrg";
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
 * brand identity, and org-wide CRM (private notes per person + call log).
 *
 * Brand identity is resolved by ORGANIZATION (Task 8: `useClientDetail` reads
 * `client_brand` via the org's single primary row, not this member's own
 * client_id), so it's the same brand regardless of which member is queried.
 *
 * CRM (Task 11) is org-scoped too: `useOrgNotes`/`useOrgCallLogs` read
 * `admin_client_notes`/`client_call_logs` by `org_id`, covering every member of
 * the business, not just its founder.
 *
 * KNOWN LIMITATION (see docs/superpowers/specs/2026-07-12-org-centric-admin-design.md):
 * brand is still keyed on one member (the org's founder - the earliest to
 * join) rather than the org itself, so this page reads/edits it via that
 * member's client_id.
 */
export default function BusinessDetail() {
  const { orgId } = useParams();
  const { data: org, isLoading: orgLoading } = useOrgHeader(orgId);
  const { data: founder, isLoading: founderLoading } = useOrgFounder(orgId);
  const { data: members } = useAdminOrgMembers(orgId);
  const { data: orgProjects, isLoading: projectsLoading } = useOrgProjects(orgId);
  const { data: orgNotes, isLoading: notesLoading } = useOrgNotes(orgId);
  const { data: orgCalls, isLoading: callsLoading } = useOrgCallLogs(orgId);
  // Brand resolves via the org (see file header); it's still founder-keyed -
  // see the KNOWN LIMITATION note above.
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
          {/* Contact (the founding member's own profile - email/phone) */}
          <Card id="bd-details" data-section className="scroll-mt-20 space-y-3 p-5">
            <h2 className="font-heading text-lg font-semibold text-foreground">פרטי קשר</h2>
            {founderDetailLoading ? (
              <Skeleton className="h-16 w-full rounded-xl" />
            ) : (
              <dl className="grid gap-3 sm:grid-cols-2">
                <Field label="אימייל" value={profile?.email || "-"} mono copyable />
                <Field label="טלפון" value={profile?.phone || "-"} mono copyable />
              </dl>
            )}
          </Card>

          {/* Team + access (members, caps, presets, pending, invite requests) */}
          <OrgMembersSection clientId={founder.user_id} />

          {/* CRM (org-scoped, Task 11): private notes per person + call log,
              covering every member of the business, not just the founder. */}
          <Card id="bd-crm" data-section className="scroll-mt-20 space-y-4 p-5">
            <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
              <Users className="size-5 text-muted-foreground" /> מידע CRM לפי איש קשר
            </h2>
            {notesLoading ? (
              <Skeleton className="h-16 w-full rounded-xl" />
            ) : !orgNotes?.length ? (
              <p className="text-sm text-muted-foreground">אין עדיין מידע CRM לאף איש קשר בעסק.</p>
            ) : (
              <div className="space-y-3">
                {orgNotes.map((n) => (
                  <div key={n.id} className="rounded-xl border border-border bg-background/30 p-4">
                    <p className="font-heading text-sm font-bold text-foreground">
                      {n.full_name || n.email || "-"}
                    </p>
                    <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                      <Field label="מין" value={n.gender ? genderHe[n.gender] : "-"} />
                      <Field label="תפקיד בחברה" value={n.role_in_company || "-"} />
                    </dl>
                    {n.content && (
                      <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{n.content}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card id="bd-calls" data-section className="scroll-mt-20 space-y-3 p-5">
            <h2 className="font-heading text-lg font-semibold text-foreground">סיכומי שיחות</h2>
            {callsLoading ? (
              <Skeleton className="h-16 w-full rounded-xl" />
            ) : !orgCalls?.length ? (
              <p className="text-sm text-muted-foreground">אין עדיין סיכומי שיחות. אפשר להוסיף דרך עריכת הלקוח.</p>
            ) : (
              <ul className="space-y-2">
                {orgCalls.map((c) => (
                  <li key={c.id} className="rounded-lg border border-border bg-background/30 px-3 py-2">
                    <p className="whitespace-pre-wrap text-sm text-foreground">{c.summary}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date(c.created_at).toLocaleString("he-IL")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>

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
