import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, Users, Eye, UserX, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { CenteredLoader } from "@/components/ui/brand-spinner";
import { useTheme } from "@/hooks/useTheme";

const GREEN = "#B4D670";
const CYAN = "#77becf";

type EventRow = {
  event: string;
  role: string | null;
  path: string | null;
  meta: { device?: string } | null;
  user_id: string | null;
  created_at: string;
};
type Person = { id: string; full_name: string | null; email: string; role: string };
type ActivityRow = { id: string; last_sign_in_at: string | null; created_at: string };

const PAGE_LABELS: Record<string, string> = {
  "/": "לוח בקרה (לקוח)",
  "/partner": "תוכנית שותפים",
  "/profile": "פרופיל",
  "/projects/:id": "עמוד פרויקט",
  "/partner-portal": "לוח בקרה (שותף)",
  "/partner-portal/new-lead": "הגשת ליד",
  "/partner-portal/resources": "חומרי מכירה",
};

const DAY = 86400000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const fmtDay = (t: number) => {
  const d = new Date(t);
  return `${d.getDate()}/${d.getMonth() + 1}`;
};

function useAnalytics() {
  return useQuery({
    queryKey: ["usage-analytics"],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * DAY).toISOString();
      const [{ data: events }, { data: people }, { data: activity }] = await Promise.all([
        supabase
          .from("usage_events")
          .select("event, role, path, meta, user_id, created_at")
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(8000),
        supabase.from("profiles").select("id, full_name, email, role").in("role", ["client", "partner"]),
        // Authoritative last-login from auth.users (usage_events can miss a session).
        supabase.rpc("admin_user_activity"),
      ]);
      return {
        events: (events ?? []) as EventRow[],
        people: (people ?? []) as Person[],
        activity: (activity ?? []) as ActivityRow[],
      };
    },
  });
}

export default function Analytics() {
  const { data, isLoading, isFetching, refetch } = useAnalytics();
  const { theme } = useTheme();
  // Chart text must read on whichever theme the admin uses (canvas/SVG can't use
  // CSS vars): near-white on dark, near-black on light.
  const axis = theme === "dark" ? "#e4e4e7" : "#27272a";

  const agg = useMemo(() => {
    const events = data?.events ?? [];
    const people = data?.people ?? [];
    const now = Date.now();
    const weekAgo = now - 7 * DAY;

    const activity = data?.activity ?? [];
    const sessions = events.filter((e) => e.event === "session");
    const views = events.filter((e) => e.event === "page_view");
    const inWeek = (e: EventRow) => new Date(e.created_at).getTime() >= weekAgo;

    // Authoritative last-login per user (from auth.users).
    const lastSignIn = new Map<string, number>();
    for (const a of activity) {
      if (a.last_sign_in_at) lastSignIn.set(a.id, new Date(a.last_sign_in_at).getTime());
    }

    // Logins per day, last 14 days (best-effort, from in-app session events).
    const today = startOfDay(new Date());
    const loginsByDay = Array.from({ length: 14 }, (_, i) => {
      const day = today - (13 - i) * DAY;
      const count = sessions.filter((s) => startOfDay(new Date(s.created_at)) === day).length;
      return { day: fmtDay(day), כניסות: count };
    });

    // Active this week = signed in within 7 days (reliable). Page views from events.
    const activeUsers = people.filter((p) => (lastSignIn.get(p.id) ?? 0) >= weekAgo).length;
    const views7d = views.filter(inWeek).length;

    // Device split (from sessions).
    const mobile = sessions.filter((s) => s.meta?.device === "mobile").length;
    const desktop = sessions.length - mobile;
    const device = [
      { name: "דסקטופ", value: desktop, color: GREEN },
      { name: "מובייל", value: mobile, color: CYAN },
    ].filter((d) => d.value > 0);

    // Top pages.
    const pageCounts = new Map<string, number>();
    for (const v of views) {
      const key = v.path ?? "אחר";
      pageCounts.set(key, (pageCounts.get(key) ?? 0) + 1);
    }
    const topPages = [...pageCounts.entries()]
      .map(([path, count]) => ({ name: PAGE_LABELS[path] ?? path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 7);

    // Dormant = logged in at least once but not in the last 14 days (by real
    // sign-in). Never-logged-in users are tracked separately (invited, not yet
    // onboarded) so a freshly-invited person isn't flagged as "disconnected".
    const dormant = people
      .map((p) => ({ ...p, seen: lastSignIn.get(p.id) }))
      .filter((p) => p.seen && now - p.seen > 14 * DAY)
      .map((p) => ({ ...p, days: Math.floor((now - p.seen!) / DAY) }))
      .sort((a, b) => b.days - a.days);

    const neverLoggedIn = people.filter((p) => !lastSignIn.get(p.id));

    return {
      activeUsers,
      views7d,
      device,
      loginsByDay,
      topPages,
      dormant,
      neverLoggedIn,
      total: events.length + activity.length,
    };
  }, [data]);

  if (isLoading) return <CenteredLoader />;

  const kpis = [
    { label: "פעילים השבוע", value: agg.activeUsers, icon: Users },
    { label: "צפיות עמוד (7 ימים)", value: agg.views7d, icon: Eye },
    { label: "לא נכנסו 14 יום+", value: agg.dormant.length, icon: UserX },
    { label: "טרם נכנסו", value: agg.neverLoggedIn.length, icon: Activity },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-heading text-2xl font-black text-foreground">אנליטיקות</h1>
          <p className="text-sm text-muted-foreground">
            שימוש בפורטל של לקוחות ושותפים. הכניסה האחרונה מבוססת על התחברות אמיתית. הנתונים שלך כאדמין לא נמדדים.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
          רענון
        </Button>
      </div>

      {agg.total === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">
          עדיין אין נתוני שימוש. ברגע שלקוחות ושותפים יתחילו להיכנס, הגרפים יתמלאו כאן.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {kpis.map((k) => (
              <div key={k.label} className="rounded-2xl border bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <k.icon className="size-4" />
                  <span className="text-xs">{k.label}</span>
                </div>
                <p className="mt-2 font-heading text-3xl font-black text-foreground">{k.value}</p>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border bg-card p-4">
            <h2 className="mb-4 text-sm font-medium text-muted-foreground">כניסות לאורך זמן</h2>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={agg.loginsByDay} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="gLogins" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={GREEN} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={GREEN} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} width={28} />
                <Tooltip
                  contentStyle={{ background: "#16151D", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff" }}
                  cursor={{ stroke: GREEN, strokeOpacity: 0.3 }}
                />
                <Area type="monotone" dataKey="כניסות" stroke={GREEN} strokeWidth={2} fill="url(#gLogins)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-2xl border bg-card p-4 lg:col-span-2">
              <h2 className="mb-4 text-sm font-medium text-muted-foreground">עמודים בשימוש (צפיות)</h2>
              <div dir="ltr">
              <ResponsiveContainer width="100%" height={Math.max(180, agg.topPages.length * 38)}>
                <BarChart data={agg.topPages} layout="vertical" margin={{ top: 0, right: 12, left: 8, bottom: 0 }}>
                  <XAxis type="number" tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: axis, fontSize: 11 }} axisLine={false} tickLine={false} width={120} />
                  <Tooltip
                    contentStyle={{ background: "#16151D", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff" }}
                    cursor={{ fill: "rgba(180,214,112,0.08)" }}
                  />
                  <Bar dataKey="count" fill={GREEN} radius={[0, 5, 5, 0]} barSize={16} />
                </BarChart>
              </ResponsiveContainer>
              </div>
            </div>

            <div className="rounded-2xl border bg-card p-4">
              <h2 className="mb-4 text-sm font-medium text-muted-foreground">מכשיר</h2>
              {agg.device.length ? (
                <>
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie data={agg.device} dataKey="value" nameKey="name" innerRadius={45} outerRadius={68} paddingAngle={3}>
                        {agg.device.map((d) => (
                          <Cell key={d.name} fill={d.color} stroke="transparent" />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#16151D", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#fff" }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-2 flex justify-center gap-4 text-xs text-muted-foreground">
                    {agg.device.map((d) => (
                      <span key={d.name} className="flex items-center gap-1.5">
                        <span className="size-2.5 rounded-sm" style={{ background: d.color }} />
                        {d.name} {d.value}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">אין נתונים</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border bg-card p-4">
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">תשומת לב נדרשת, לא נכנסו 14 יום+</h2>
              {agg.dormant.length ? (
                <div className="space-y-2">
                  {agg.dormant.slice(0, 8).map((p) => (
                    <div key={p.id} className="flex items-center gap-3 text-sm">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
                        <UserX className="size-4" />
                      </span>
                      <span className="min-w-0 truncate text-foreground">{p.full_name || p.email}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {p.role === "partner" ? "שותף" : "לקוח"}
                      </span>
                      <span className="ms-auto shrink-0 text-xs text-muted-foreground">לפני {p.days} ימים</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">כולם נכנסו לאחרונה. מצוין.</p>
              )}
            </div>

            <div className="rounded-2xl border bg-card p-4">
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">הוזמנו, טרם נכנסו</h2>
              {agg.neverLoggedIn.length ? (
                <div className="space-y-2">
                  {agg.neverLoggedIn.slice(0, 8).map((p) => (
                    <div key={p.id} className="flex items-center gap-3 text-sm">
                      <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                        <Activity className="size-4" />
                      </span>
                      <span className="min-w-0 truncate text-foreground">{p.full_name || p.email}</span>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {p.role === "partner" ? "שותף" : "לקוח"}
                      </span>
                      <span className="ms-auto shrink-0 text-xs text-muted-foreground">ממתין לכניסה ראשונה</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">כולם כבר נכנסו לפחות פעם אחת.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
