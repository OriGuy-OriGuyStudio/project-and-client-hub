import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase";
import { toast, toastError } from "@/hooks/use-toast";

/**
 * Retrofit prompt for an ORPHAN client: one who was approved before every client
 * got a business, so they have no organization and can't be linked to projects.
 * Renders nothing once the client belongs to an org. Confirming runs
 * `convert_client_to_business` (creates the org + membership, links their brand +
 * projects) and jumps to the new business page.
 */
export function ConvertClientToBusiness({
  clientId,
  defaultName,
}: {
  clientId: string;
  defaultName: string;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState(defaultName);
  const [saving, setSaving] = useState(false);

  useEffect(() => setName(defaultName), [defaultName]);

  // Does this client already belong to a business?
  const { data: orgId, isLoading } = useQuery({
    queryKey: ["client-org-membership", clientId],
    queryFn: async (): Promise<string | null> => {
      const { data } = await supabase
        .from("organization_members")
        .select("org_id")
        .eq("user_id", clientId)
        .limit(1)
        .maybeSingle();
      return data?.org_id ?? null;
    },
  });

  if (isLoading || orgId) return null; // already has a business, or still checking

  async function convert() {
    if (!name.trim()) return toastError("צריך שם עסק.");
    setSaving(true);
    const { data, error } = await supabase.rpc("convert_client_to_business", {
      p_client_id: clientId,
      p_business_name: name.trim(),
    });
    setSaving(false);
    if (error) return toastError(error.message || "המרה לעסק נכשלה.");
    const res = data as { status?: string; org_id?: string } | null;
    toast({ title: "העסק הוקם ✓", variant: "success" });
    qc.invalidateQueries({ queryKey: ["admin-businesses"] });
    qc.invalidateQueries({ queryKey: ["client-detail", clientId] });
    if (res?.org_id) navigate(`/admin/businesses/${res.org_id}`);
  }

  return (
    <Card className="space-y-3 border-primary/40 bg-primary/[0.05] p-5">
      <div className="flex items-start gap-2">
        <Building2 className="mt-0.5 size-5 shrink-0 text-primary" />
        <div>
          <h2 className="font-heading text-lg font-semibold text-foreground">הלקוח לא משויך לעסק</h2>
          <p className="text-sm text-muted-foreground">
            לקוח זה אושר לפני שכל לקוח קיבל עסק, ולכן אי אפשר לשייך אותו לפרויקטים. המר אותו לעסק,
            והמותג והפרויקטים הקיימים שלו יקושרו לעסק החדש.
          </p>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="cvt-biz">שם העסק</Label>
        <Input
          id="cvt-biz"
          value={name}
          maxLength={160}
          onChange={(e) => setName(e.target.value)}
          placeholder="השם שיופיע לעסק בפורטל"
        />
      </div>
      <div>
        <Button onClick={convert} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Building2 className="size-4" />}
          המר לעסק
        </Button>
      </div>
    </Card>
  );
}
