import { useMemo, useState } from "react";
import { Inbox, Settings2, Users } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { SortableTh, type SortDir } from "@/components/ui/sortable-th";
import { AdminLeadsSection } from "@/components/partner/AdminLeadsSection";
import { ManageReferralDialog } from "@/pages/admin/Referrals";
import { useAdminReferrals, type AdminReferral } from "@/hooks/useAdminReferrals";
import { referralStatusHe, referralStatusVariant } from "@/lib/status";

/** One place for every incoming lead: partner-submitted leads and client referrals. */
export default function Leads() {
  return (
    <div className="space-y-10">
      <PageHeader
        title="כל הלידים"
        subtitle="כל הלידים במקום אחד, חלוקה ללידים משותפים ולהפניות מלקוחות."
      />
      <AdminLeadsSection />
      <ClientReferralsSection />
    </div>
  );
}

type RefSortKey = "referred" | "referrer" | "deal" | "status" | "created";

function ClientReferralsSection() {
  const { data, isLoading } = useAdminReferrals();
  const [active, setActive] = useState<AdminReferral | null>(null);
  const [sort, setSort] = useState<{ key: RefSortKey; dir: SortDir }>({
    key: "created",
    dir: "desc",
  });
  const refs = data?.referrals ?? [];

  function toggleSort(key: RefSortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  const sorted = useMemo(() => {
    const arr = [...refs];
    const d = sort.dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sort.key) {
        case "referred":
          return a.referred_name.localeCompare(b.referred_name, "he") * d;
        case "referrer":
          return a.referrer_name.localeCompare(b.referrer_name, "he") * d;
        case "deal":
          return ((a.deal_value ?? 0) - (b.deal_value ?? 0)) * d;
        case "status":
          return a.status.localeCompare(b.status) * d;
        case "created":
          return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * d;
        default:
          return 0;
      }
    });
    return arr;
  }, [refs, sort]);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Users className="size-5 text-brand-cyan-base" />
        <h2 className="font-heading text-lg font-bold text-foreground">לידים מלקוחות (הפניות)</h2>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      ) : !refs.length ? (
        <EmptyState icon={Inbox} title="אין עדיין הפניות מלקוחות" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/60">
                <SortableTh label="מופנה" active={sort.key === "referred"} dir={sort.dir} onClick={() => toggleSort("referred")} />
                <SortableTh label="מפנה" active={sort.key === "referrer"} dir={sort.dir} onClick={() => toggleSort("referrer")} />
                <SortableTh label="ערך עסקה" active={sort.key === "deal"} dir={sort.dir} onClick={() => toggleSort("deal")} />
                <SortableTh label="סטטוס" active={sort.key === "status"} dir={sort.dir} onClick={() => toggleSort("status")} />
                <SortableTh label="תאריך" active={sort.key === "created"} dir={sort.dir} onClick={() => toggleSort("created")} />
                <th className="px-3 py-2 text-start font-medium text-muted-foreground">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {sorted.map((r) => (
                <tr key={r.id} className="text-foreground">
                  <td className="px-3 py-2.5 font-medium">{r.referred_name}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{r.referrer_name}</td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                    {r.deal_value ? `₪${r.deal_value.toLocaleString("he-IL")}` : "-"}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant={referralStatusVariant[r.status]}>{referralStatusHe[r.status]}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString("he-IL")}
                  </td>
                  <td className="px-3 py-2.5">
                    <Button variant="ghost" size="icon" aria-label="ניהול" onClick={() => setActive(r)}>
                      <Settings2 className="size-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ManageReferralDialog referral={active} onClose={() => setActive(null)} />
    </section>
  );
}
