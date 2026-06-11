import { useParams, Link } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  Coins,
  FolderKanban,
  Handshake,
  Mail,
  MessageCircle,
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
import { useClientDetail } from "@/hooks/useClientDetail";

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
  const { data, isLoading } = useClientDetail(id);

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

  const { profile, brand, note, calls, projects, referralCount, credits, enrolled } = data;
  const phone = profile.phone;

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
        <Link to="/admin/clients">
          <ArrowRight className="size-4" /> לכל הלקוחות
        </Link>
      </Button>

      <PageHeader
        title={brand?.business_name || profile.full_name || "לקוח"}
        subtitle={profile.full_name || undefined}
        actions={
          <div className="flex items-center gap-1">
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
            <Button variant="secondary" size="icon" asChild aria-label="מייל">
              <a
                href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(profile.email)}`}
                target="_blank"
                rel="noreferrer noopener"
              >
                <Mail className="size-4" />
              </a>
            </Button>
          </div>
        }
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

      {/* Contact + CRM */}
      <Card className="space-y-3 p-5">
        <h2 className="font-heading text-lg font-semibold text-foreground">פרטים ומידע אישי</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label="אימייל" value={profile.email} mono />
          <Field label="טלפון" value={phone || "—"} mono />
          <Field label="מין" value={note?.gender ? genderHe[note.gender] : "—"} />
          <Field label="תפקיד בחברה" value={note?.role_in_company || "—"} />
        </dl>
        {note?.content && (
          <div>
            <p className="text-sm font-medium text-foreground">מידע אישי</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{note.content}</p>
          </div>
        )}
      </Card>

      {/* Projects */}
      <div>
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
      <Card className="space-y-3 p-5">
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
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono-code text-sm text-foreground" : "text-sm text-foreground"}>
        {value}
      </dd>
    </div>
  );
}
