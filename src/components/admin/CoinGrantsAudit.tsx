import { Gift } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { CoinGrant } from "@/types/database";

function dt(s: string | null) {
  return s ? new Date(s).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }) : "—";
}

/**
 * Admin audit trail of gift/compensation grants: email status, whether the
 * recipient acknowledged it in the portal, and the exact send/ack timestamps.
 * Kept for disputes ("I never got it").
 */
export function CoinGrantsAudit({ grants }: { grants: CoinGrant[] }) {
  if (!grants.length) return null;
  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 font-heading text-lg font-bold text-foreground">
        <Gift className="size-5" /> מתנות ופיצויים
      </h2>
      <div className="space-y-2">
        {grants.map((g) => (
          <Card key={g.id} className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-foreground">
                {g.kind === "compensation" ? "💛 פיצוי" : "🎁 מתנה"} · {g.amount} מטבעות
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge
                  variant={
                    g.email_status === "sent"
                      ? "success"
                      : g.email_status === "failed"
                        ? "destructive"
                        : "warning"
                  }
                >
                  {g.email_status === "sent" ? "מייל נשלח ✓" : g.email_status === "failed" ? "מייל נכשל" : "מייל ממתין"}
                </Badge>
                <Badge variant={g.acknowledged_at ? "success" : "secondary"}>
                  {g.acknowledged_at ? "המקבל אישר ✓" : "טרם אושר"}
                </Badge>
              </div>
            </div>
            {g.reason && <p className="mt-1 text-xs text-muted-foreground">סיבה: {g.reason}</p>}
            <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">
              <span>נשלח: {dt(g.created_at)}</span>
              <span>אושר על ידי המקבל: {dt(g.acknowledged_at)}</span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
