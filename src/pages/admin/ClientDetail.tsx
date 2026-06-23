import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  Coins,
  FolderKanban,
  Gift,
  Globe,
  Handshake,
  Mail,
  MessageCircle,
  Palette,
  Phone,
  Sparkles,
  Unlock,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ProjectCard } from "@/components/project/ProjectCard";
import { ColorSwatch } from "@/components/brand/ColorSwatch";
import { CopyButton } from "@/components/ui/copy-button";
import { BrandIdentityEditor } from "@/components/brand/BrandIdentityEditor";
import {
  iconForPlatform,
  labelForPlatform,
  normalizeSocialLinks,
} from "@/components/brand/social";
import { useClientDetail, type ClientDetailData } from "@/hooks/useClientDetail";
import { SelectMenu } from "@/components/ui/select-menu";
import { StatusPipeline } from "@/components/partner/StatusPipeline";
import { referralStatusHe, referralStatusVariant } from "@/lib/status";
import type { Referral, ReferralStatus } from "@/types/database";
import { GrantCoinsDialog } from "@/components/admin/GrantCoinsDialog";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { CoinGrantsAudit } from "@/components/admin/CoinGrantsAudit";
import { supabase } from "@/lib/supabase";
import { sendInvite, sendRedemptionNotice } from "@/lib/invite";
import { SectionNav } from "@/components/layout/SectionNav";
import { toast, toastError } from "@/hooks/use-toast";

const genderHe: Record<string, string> = { male: "זכר", female: "נקבה", other: "אחר" };

function waLink(phone: string) {
  const digits = phone.replace(/\D/g, "").replace(/^0/, "972");
  return `https://wa.me/${digits}`;
}

function Stat({ icon: Icon, label, value }: { icon: typeof Coins; label: string; value: string | number }) {
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

// Inline stage editing for the client's referrals (closing, with deal value +
// credits, stays in the dedicated referrals form).
const REFERRAL_EDIT_STATUSES: ReferralStatus[] = [
  "submitted",
  "awaiting_intro",
  "intro_done",
  "quote_sent",
  "client_approved",
  "not_relevant",
];

function ClientReferrals({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { data: referrals, isLoading } = useQuery({
    queryKey: ["client-referrals", clientId],
    queryFn: async (): Promise<Referral[]> => {
      const { data, error } = await supabase
        .from("referrals")
        .select("*")
        .eq("referrer_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function updateStatus(refId: string, status: ReferralStatus) {
    const { error } = await supabase.from("referrals").update({ status }).eq("id", refId);
    if (error) return toastError("עדכון הסטטוס נכשל.");
    toast({ title: "הסטטוס עודכן", variant: "success" });
    qc.invalidateQueries({ queryKey: ["client-referrals", clientId] });
    qc.invalidateQueries({ queryKey: ["client-detail", clientId] });
  }

  return (
    <div data-section className="scroll-mt-20">
      <h2 className="mb-3 flex items-center gap-2 font-heading text-lg font-bold text-foreground">
        <Handshake className="size-5" /> ההפניות שלו
      </h2>
      {isLoading ? (
        <Skeleton className="h-20 w-full rounded-2xl" />
      ) : !referrals?.length ? (
        <EmptyState icon={Handshake} title="עוד לא הגיש הפניות" />
      ) : (
        <div className="space-y-2">
          {referrals.map((r) => (
            <Card key={r.id} className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{r.referred_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("he-IL")}
                    {r.deal_value ? ` · עסקה ₪${r.deal_value.toLocaleString("he-IL")}` : ""}
                  </p>
                </div>
                {r.status === "closed" ? (
                  <Badge variant={referralStatusVariant.closed} className="shrink-0">
                    {referralStatusHe.closed}
                  </Badge>
                ) : (
                  <div className="w-40 shrink-0">
                    <SelectMenu
                      ariaLabel="סטטוס ההפניה"
                      variant="field"
                      value={r.status}
                      onChange={(v) => updateStatus(r.id, v as ReferralStatus)}
                      options={REFERRAL_EDIT_STATUSES.map((s) => ({
                        value: s,
                        label: referralStatusHe[s],
                      }))}
                    />
                  </div>
                )}
              </div>
              <StatusPipeline status={r.status} />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ClientDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { data, isLoading } = useClientDetail(id);
  const [giftOpen, setGiftOpen] = useState(false);
  const [busyRedemption, setBusyRedemption] = useState<string | null>(null);
  const [releaseTarget, setReleaseTarget] = useState<{ id: string; name?: string } | null>(null);

  async function setRedemption(
    redId: string,
    status: "fulfilled" | "cancelled",
    rewardName?: string
  ) {
    setBusyRedemption(redId);
    const { error } = await supabase.rpc("set_client_redemption_status", {
      p_id: redId,
      p_status: status,
    });
    setBusyRedemption(null);
    if (error) return toastError(error.message || "עדכון המימוש נכשל.");
    if (status === "fulfilled" && id) void sendRedemptionNotice(id, rewardName || "");
    toast({
      title: status === "fulfilled" ? "המימוש סומן כטופל ✓" : "המימוש סומן כלא אושר והקרדיטים הוחזרו",
      variant: "success",
    });
    qc.invalidateQueries({ queryKey: ["client-detail", id] });
  }

  // Cancel ALL of this client's active redemptions of a reward, freeing it to be
  // redeemed again (a one-time reward stays locked while any fulfilled one exists).
  async function releaseReward(rewardId: string, rewardName?: string) {
    const targets = (data?.redemptions ?? []).filter(
      (r) => r.reward_id === rewardId && r.status !== "cancelled"
    );
    if (!targets.length) return;
    setBusyRedemption("release-" + rewardId);
    for (const t of targets) {
      const { error } = await supabase.rpc("set_client_redemption_status", {
        p_id: t.id,
        p_status: "cancelled",
      });
      if (error) {
        setBusyRedemption(null);
        return toastError(error.message || "שחרור הפרס נכשל.");
      }
    }
    setBusyRedemption(null);
    toast({ title: `"${rewardName ?? "הפרס"}" שוחרר. הלקוח יכול לממש שוב`, variant: "success" });
    qc.invalidateQueries({ queryKey: ["client-detail", id] });
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }
  if (!data?.profile) {
    return <EmptyState icon={Building2} title="הלקוח לא נמצא" />;
  }

  const { profile, brand, colors, note, calls, projects, referralCount, credits, enrolled, curious, grants, redemptions, invite } = data;
  const hasBrand =
    !!brand?.logo_url ||
    !!brand?.business_name ||
    !!brand?.business_description ||
    colors.length > 0 ||
    !!brand?.website_url ||
    normalizeSocialLinks(brand?.social_links).length > 0;
  const phone = profile.phone;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
        <Link to="/admin/clients">
          <ArrowRight className="size-4" /> לכל הלקוחות
        </Link>
      </Button>

      <PageHeader
        title={
          <span className="inline-flex flex-wrap items-center gap-2">
            {brand?.business_name || profile.full_name || "לקוח"}
            {curious && (
              <Badge variant="success" title="גילה את ה-Easter Egg והרוויח 5 מטבעות">
                🔭 סקרן
              </Badge>
            )}
          </span>
        }
        subtitle={profile.full_name || undefined}
        actions={
          <div className="flex items-center gap-1">
            <Button variant="secondary" size="sm" onClick={() => setGiftOpen(true)}>
              <Gift className="size-4" /> מתנה
            </Button>
            {phone && (
              <Button variant="secondary" size="icon" asChild aria-label="וואטסאפ">
                <a href={waLink(phone)} target="_blank" rel="noreferrer noopener">
                  <MessageCircle className="size-4 text-brand-green-base" />
                </a>
              </Button>
            )}
            {phone && (
              <Button variant="secondary" size="icon" asChild aria-label="חיוג">
                <a href={`tel:${phone.replace(/\s/g, "")}`}>
                  <Phone className="size-4" />
                </a>
              </Button>
            )}
            {phone && (
              <CopyButton
                content={phone}
                variant="secondary"
                size="icon"
                toastMessage="הטלפון הועתק"
                title="העתקת טלפון"
              />
            )}
            <Button variant="secondary" size="icon" asChild aria-label="מייל">
              <a
                href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(profile.email)}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                <Mail className="size-4" />
              </a>
            </Button>
            <CopyButton
              content={profile.email}
              variant="secondary"
              size="icon"
              toastMessage="האימייל הועתק"
              title="העתקת אימייל"
            />
          </div>
        }
      />

      <GrantCoinsDialog
        open={giftOpen}
        onClose={() => setGiftOpen(false)}
        userId={id!}
        recipientName={profile.full_name || undefined}
        invalidateKeys={[["client-detail", id]]}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={FolderKanban} label="פרויקטים" value={projects.length} />
        <Stat icon={Handshake} label="הפניות" value={referralCount} />
        <Stat icon={Coins} label="קרדיטים" value={credits} />
        <Card className="p-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Sparkles className="size-4" />
            <span className="text-sm">תוכנית שותפים</span>
          </div>
          <p className="mt-2">
            <Badge variant={enrolled ? "success" : "secondary"}>
              {enrolled ? "מאושר" : "לא מאושר"}
            </Badge>
          </p>
        </Card>
      </div>

      <SectionNav />

      {/* Contact + CRM */}
      <Card id="cd-details" data-section className="scroll-mt-20 space-y-3 p-5">
        <h2 className="font-heading text-lg font-semibold text-foreground">פרטים ומידע אישי</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label="אימייל" value={profile.email} mono copyable />
          <Field label="טלפון" value={phone || "-"} mono copyable />
          <Field label="מין" value={note?.gender ? genderHe[note.gender] : "-"} />
          <Field label="תפקיד בחברה" value={note?.role_in_company || "-"} />
        </dl>
        <InviteStatus email={profile.email} invite={invite} clientId={id} />
        {note?.content && (
          <div>
            <p className="text-sm font-medium text-foreground">מידע אישי</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{note.content}</p>
          </div>
        )}
      </Card>

      {/* Brand identity */}
      <Card id="cd-brand" data-section className="scroll-mt-20 space-y-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-heading text-lg font-semibold text-foreground">
            <Palette className="size-5 text-brand-cyan-base" />
            זהות מותג
          </h2>
          <BrandIdentityEditor clientId={profile.id} brand={brand} colors={colors} />
        </div>

        {!hasBrand ? (
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

      {/* Projects */}
      <div id="cd-projects" data-section className="scroll-mt-20">
        <h2 className="mb-3 font-heading text-lg font-bold text-foreground">הפרויקטים שלו</h2>
        {projects.length === 0 ? (
          <EmptyState icon={FolderKanban} title="אין עדיין פרויקטים" />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p, i) => (
              <ProjectCard
                key={p.id}
                index={i}
                project={{ ...p, business_name: brand?.business_name ?? null, logo_url: brand?.logo_url ?? null, logo_fit: brand?.logo_fit ?? "auto" }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Referrals (partner program) */}
      {(enrolled || referralCount > 0) && <ClientReferrals clientId={id!} />}

      {/* Call log */}
      <Card id="cd-calls" data-section className="scroll-mt-20 space-y-3 p-5">
        <h2 className="font-heading text-lg font-semibold text-foreground">סיכומי שיחות</h2>
        {calls.length === 0 ? (
          <p className="text-sm text-muted-foreground">אין עדיין סיכומי שיחות. אפשר להוסיף דרך עריכת הלקוח.</p>
        ) : (
          <ul className="space-y-2">
            {calls.map((c) => (
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

      {redemptions.length > 0 && (
        <div id="cd-redemptions" data-section className="scroll-mt-20">
          <h2 className="mb-3 flex items-center gap-2 font-heading text-lg font-bold text-foreground">
            <Gift className="size-5" /> מימושים בחנות
          </h2>
          <div className="space-y-2">
            {redemptions.map((r) => (
              <Card
                key={r.id}
                className={
                  "flex flex-wrap items-center justify-between gap-3 p-4" +
                  (r.status === "pending" ? "" : " opacity-60")
                }
              >
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{r.reward?.name ?? "פרס"}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.redeemed_at).toLocaleDateString("he-IL")} · {r.credits_spent} קרדיטים
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      r.status === "fulfilled"
                        ? "success"
                        : r.status === "cancelled"
                          ? "secondary"
                          : "warning"
                    }
                  >
                    {r.status === "fulfilled" ? "טופל" : r.status === "cancelled" ? "לא אושר" : "ממתין"}
                  </Badge>
                  {r.status === "pending" && (
                    <Button
                      size="sm"
                      disabled={busyRedemption === r.id}
                      onClick={() => setRedemption(r.id, "fulfilled", r.reward?.name)}
                    >
                      אישור
                    </Button>
                  )}
                  {r.status === "pending" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busyRedemption === r.id}
                      onClick={() => setRedemption(r.id, "cancelled")}
                    >
                      לא אושר
                    </Button>
                  )}
                  {r.status === "fulfilled" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busyRedemption === "release-" + r.reward_id}
                      onClick={() => setReleaseTarget({ id: r.reward_id, name: r.reward?.name })}
                    >
                      <Unlock className="size-4" /> שחרר פרס
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!releaseTarget}
        onOpenChange={(o) => !o && setReleaseTarget(null)}
        title="שחרור פרס"
        destructive={false}
        confirmLabel="שחרר את הפרס"
        description={
          <span className="block space-y-2 text-start">
            <span className="block">
              הפעולה תבטל את <b>כל</b> המימושים הפעילים של{" "}
              <b>"{releaseTarget?.name ?? "הפרס"}"</b> אצל הלקוח, תחזיר לו את הקרדיטים שהוצאו,
              ותפתח את הפרס מחדש כך שיוכל לממש אותו שוב.
            </span>
            <span className="block rounded-lg bg-muted p-2.5 text-xs">
              <b className="block text-foreground">מתי להשתמש בזה:</b>
              <span className="mt-1 block text-muted-foreground">
                • הלקוח קנה את אותו פרס פעמיים בטעות (או באג), לניקוי והחזר.
              </span>
              <span className="block text-muted-foreground">
                • רוצים לתת ללקוח לממש שוב פרס חד-פעמי שכבר נוצל.
              </span>
              <span className="block text-muted-foreground">
                • לאפס מוקדם תקופת המתנה של פרס, כדי שיוכל לממש כבר עכשיו.
              </span>
            </span>
            <span className="block text-xs text-muted-foreground">
              <b>ההבדל מ"לא אושר":</b> "לא אושר" מבטל מימוש <b>בודד</b> (דחיית בקשה שממתינה)
              ומחזיר קרדיטים. "שחרר פרס" עושה את אותו דבר על <b>כל</b> המימושים של הפרס יחד.
            </span>
          </span>
        }
        onConfirm={() => releaseTarget && releaseReward(releaseTarget.id, releaseTarget.name)}
      />

      {grants.length > 0 && (
        <div id="cd-grants" data-section className="scroll-mt-20">
          <CoinGrantsAudit grants={grants} />
        </div>
      )}
    </div>
  );
}

function InviteStatus({
  email,
  invite,
  clientId,
}: {
  email: string;
  invite: ClientDetailData["invite"];
  clientId: string | undefined;
}) {
  const qc = useQueryClient();
  const [sending, setSending] = useState(false);

  async function resend() {
    setSending(true);
    const r = await sendInvite(email);
    setSending(false);
    if (r.ok) toast({ title: "ההזמנה נשלחה שוב ✓", variant: "success" });
    else toastError("שליחת ההזמנה נכשלה.");
    qc.invalidateQueries({ queryKey: ["client-detail", clientId] });
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border bg-field px-3 py-2">
      <div className="text-sm">
        <span className="text-muted-foreground">הזמנת כניסה ל-Orion: </span>
        {invite?.invite_sent_at ? (
          <span className="font-medium text-brand-green-base">
            ✓ נשלחה ב-{new Date(invite.invite_sent_at).toLocaleDateString("he-IL")}
            {invite.invite_send_count > 1 ? ` · ${invite.invite_send_count} שליחות` : ""}
          </span>
        ) : (
          <span className="text-foreground">טרם נשלחה</span>
        )}
      </div>
      <Button variant="secondary" size="sm" disabled={sending} onClick={resend}>
        <Mail className="size-4" />
        {invite?.invite_sent_at ? "שלח שוב" : "שלח הזמנה"}
      </Button>
    </div>
  );
}

function Field({
  label,
  value,
  mono,
  copyable,
}: {
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
}) {
  const canCopy = copyable && value && value !== "-";
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd
        className={
          "flex items-center gap-1 " +
          (mono ? "font-mono-code text-sm text-foreground" : "text-sm text-foreground")
        }
      >
        <span className="min-w-0 truncate">{value}</span>
        {canCopy && (
          <CopyButton
            content={value}
            variant="ghost"
            size="icon"
            className="size-6 shrink-0 text-muted-foreground hover:text-foreground"
            toastMessage={`${label} הועתק`}
            title={`העתקת ${label}`}
          />
        )}
      </dd>
    </div>
  );
}
