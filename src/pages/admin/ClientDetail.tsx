import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Building2,
  Coins,
  FolderKanban,
  Gift,
  Handshake,
  Mail,
  MessageCircle,
  Palette,
  Phone,
  Sparkles,
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
import { useClientDetail, type ClientDetailData } from "@/hooks/useClientDetail";
import { GrantCoinsDialog } from "@/components/admin/GrantCoinsDialog";
import { CoinGrantsAudit } from "@/components/admin/CoinGrantsAudit";
import { supabase } from "@/lib/supabase";
import { sendInvite } from "@/lib/invite";
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

export default function ClientDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const { data, isLoading } = useClientDetail(id);
  const [giftOpen, setGiftOpen] = useState(false);
  const [busyRedemption, setBusyRedemption] = useState<string | null>(null);

  async function setRedemption(redId: string, status: "fulfilled" | "cancelled") {
    setBusyRedemption(redId);
    const { error } = await supabase.rpc("set_client_redemption_status", {
      p_id: redId,
      p_status: status,
    });
    setBusyRedemption(null);
    if (error) return toastError(error.message || "עדכון המימוש נכשל.");
    toast({
      title: status === "fulfilled" ? "המימוש סומן כטופל ✓" : "המימוש בוטל והקרדיטים הוחזרו",
      variant: "success",
    });
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
    colors.length > 0;
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
                project={{ ...p, business_name: brand?.business_name ?? null, logo_url: brand?.logo_url ?? null }}
              />
            ))}
          </div>
        )}
      </div>

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
              <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
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
                    {r.status === "fulfilled" ? "טופל" : r.status === "cancelled" ? "בוטל" : "ממתין"}
                  </Badge>
                  {r.status === "pending" && (
                    <Button
                      size="sm"
                      disabled={busyRedemption === r.id}
                      onClick={() => setRedemption(r.id, "fulfilled")}
                    >
                      אישור
                    </Button>
                  )}
                  {r.status !== "cancelled" && (
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={busyRedemption === r.id}
                      onClick={() => setRedemption(r.id, "cancelled")}
                    >
                      ביטול
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

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
