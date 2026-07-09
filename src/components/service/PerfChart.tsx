import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SiteMetric } from "@/types/database";

const fmtDay = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit" });

/**
 * A clean brand-styled area chart of one site-metric over time. Expects the raw
 * (newest-first) site_metrics; renders them chronologically. Renders a friendly
 * placeholder until at least two data points exist.
 */
export function PerfChart({
  metrics,
  field,
  color,
  name,
  unit = "",
  domain,
  height = 180,
}: {
  metrics: SiteMetric[];
  field: keyof SiteMetric;
  color: string;
  name: string;
  unit?: string;
  domain?: [number | "auto", number | "auto"];
  height?: number;
}) {
  const data = [...metrics]
    .reverse()
    .filter((m) => m[field] != null)
    .map((m) => ({ date: fmtDay(m.metric_date), value: Number(m[field]) }));

  if (data.length < 2) {
    return (
      <div className="grid place-items-center rounded-xl border border-dashed border-border text-xs text-muted-foreground" style={{ height }}>
        הנתונים יצטברו לגרף עם הזמן
      </div>
    );
  }

  const gid = `perf-${String(field)}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 10, left: -14, bottom: 0 }}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.35} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(246,244,244,.08)" vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 10, fill: "rgba(246,244,244,.5)" }} tickLine={false} axisLine={false} minTickGap={24} />
        <YAxis domain={domain ?? ["auto", "auto"]} tick={{ fontSize: 10, fill: "rgba(246,244,244,.5)" }} tickLine={false} axisLine={false} width={34} />
        <Tooltip
          contentStyle={{ background: "#16151c", border: "1px solid rgba(246,244,244,.14)", borderRadius: 12, fontSize: 12 }}
          labelStyle={{ color: "#f6f4f4" }}
          formatter={(v) => [`${v}${unit}`, name]}
        />
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2} fill={`url(#${gid})`} name={name} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
