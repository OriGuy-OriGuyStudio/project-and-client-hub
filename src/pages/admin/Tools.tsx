import { Link } from "react-router-dom";
import { UsersRound, Route as RouteIcon, Network, PenLine, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TOOLS = [
  {
    to: "/admin/tools/persona",
    icon: UsersRound,
    title: "מחולל פרסונה",
    desc: "יצירת פרסונות ללקוח מתוך שיחת האפיון, עם תמונה, בלחיצה. אתה עורך ומפרסם לעמוד הפרויקט.",
    ready: true,
  },
  {
    to: "/admin/tools/journey",
    icon: RouteIcon,
    title: "מסע לקוח",
    desc: "מפת מסע לקוח מהאפיון, שלבים עם רגשות, כאבים ומה אנחנו עושים. עריכה והצגה בעמוד הפרויקט.",
    ready: true,
  },
  {
    to: "/admin/tools/sitemap",
    icon: Network,
    title: "מפת אתר",
    desc: "עץ עמודים וסקשנים, נגזר מהאפיון, מהפרסונות וממסע הלקוח. עריכה והצגה בעמוד הפרויקט.",
    ready: true,
  },
  {
    to: "/admin/tools/copy",
    icon: PenLine,
    title: "מחולל קופי",
    desc: "טיוטת קופי לכל עמוד וסקשן, בקול המותג ולפי מפת האתר. עריכה והצגה בעמוד הפרויקט.",
    ready: true,
  },
];

export default function Tools() {
  return (
    <div>
      <PageHeader
        title="ארגז כלים"
        subtitle="כלים שחוסכים לך זמן באפיון ובניהול. חלק מהתוצרים מופיעים גם ללקוח בעמוד הפרויקט."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TOOLS.map((t) => {
          const inner = (
            <Card
              className={cn(
                "flex h-full flex-col gap-2 p-5 transition-colors",
                t.ready ? "hover:border-primary/40" : "opacity-60"
              )}
            >
              <div className="flex items-center justify-between">
                <div className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <t.icon className="size-5" />
                </div>
                {t.ready ? (
                  <Sparkles className="size-4 text-primary" />
                ) : (
                  <Badge variant="secondary">בקרוב</Badge>
                )}
              </div>
              <h3 className="font-heading text-base font-semibold text-foreground">{t.title}</h3>
              <p className="text-sm text-muted-foreground">{t.desc}</p>
            </Card>
          );
          return t.ready && t.to ? (
            <Link key={t.title} to={t.to} className="block">
              {inner}
            </Link>
          ) : (
            <div key={t.title}>{inner}</div>
          );
        })}
      </div>
    </div>
  );
}
