import { useQuery } from "@tanstack/react-query";
import { Hourglass } from "lucide-react";
import { Card } from "@/components/ui/card";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/useAuth";

type Row = { id: string; reward: { name: string } | null };

/**
 * Dashboard banner telling a client/partner that a store redemption they made
 * is waiting for the studio to handle it (e.g. issuing a voucher / donation).
 * Disappears once approved; they then get the celebratory popup + email.
 */
export function PendingRedemptionsBanner() {
  const { profile } = useAuth();
  const isPartner = profile?.role === "partner";

  const { data: names } = useQuery({
    enabled: !!profile?.id,
    queryKey: ["pending-redemptions", profile?.id],
    queryFn: async (): Promise<string[]> => {
      const uid = profile!.id;
      const res = isPartner
        ? await supabase
            .from("partner_reward_redemptions")
            .select("id, reward:rewards(name)")
            .eq("partner_id", uid)
            .eq("status", "pending")
        : await supabase
            .from("reward_redemptions")
            .select("id, reward:rewards(name)")
            .eq("client_id", uid)
            .eq("status", "pending");
      return ((res.data as unknown as Row[] | null) ?? [])
        .map((r) => r.reward?.name)
        .filter((n): n is string => !!n);
    },
  });

  if (!names || names.length === 0) return null;

  return (
    <Card className="mb-6 flex items-start gap-3 border-primary/40 bg-primary/5 p-4">
      <Hourglass className="size-5 shrink-0 text-primary" />
      <div>
        <p className="font-heading text-sm font-bold text-foreground">
          {names.length > 1 ? "המימושים שלך ממתינים לטיפול" : "המימוש שלך ממתין לטיפול"}
        </p>
        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
          {names.join(" · ")} — אני אטפל בזה בהקדם, ותקבל/י עדכון בממשק וגם מייל ברגע שזה מאושר.
        </p>
      </div>
    </Card>
  );
}
