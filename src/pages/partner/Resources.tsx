import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Copy, Download, ExternalLink, FileText, Library } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { supabase } from "@/lib/supabase";
import { toast, toastError } from "@/hooks/use-toast";
import type { PartnerResource } from "@/types/database";

export default function Resources() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["partner-resources"],
    queryFn: async (): Promise<PartnerResource[]> => {
      const { data, error } = await supabase
        .from("partner_resources")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (isError) toastError("טעינת החומרים נכשלה.");
  }, [isError]);

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "הטקסט הועתק", variant: "success" });
    } catch {
      toastError("ההעתקה נכשלה.");
    }
  }

  return (
    <div>
      <PageHeader
        title="חומרי מכירה"
        subtitle="מצגות, פורטפוליו וטקסטים מוכנים שתוכל להשתמש בהם מול לקוחות."
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-2xl" />
          ))}
        </div>
      ) : !data?.length ? (
        <EmptyState
          icon={Library}
          title="אין עדיין חומרים"
          description="כשהסטודיו יוסיף חומרי מכירה, הם יופיעו כאן."
        />
      ) : (
        <div className="space-y-3">
          {data.map((r) => (
            <Card key={r.id} className="flex items-start justify-between gap-3 p-4">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-info/15 text-info">
                  <FileText className="size-5" />
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{r.title}</p>
                  {r.description && (
                    <p className="text-sm text-muted-foreground">{r.description}</p>
                  )}
                  {r.resource_type === "text_template" && r.content && (
                    <p className="mt-2 whitespace-pre-wrap rounded-lg bg-background/40 p-3 text-sm text-muted-foreground">
                      {r.content}
                    </p>
                  )}
                </div>
              </div>

              {r.resource_type === "file" && r.file_url && (
                <Button variant="secondary" size="sm" asChild>
                  <a href={r.file_url} target="_blank" rel="noreferrer noopener">
                    <Download className="size-4" /> הורדה
                  </a>
                </Button>
              )}
              {r.resource_type === "link" && r.content && (
                <Button variant="secondary" size="sm" asChild>
                  <a href={r.content} target="_blank" rel="noreferrer noopener">
                    <ExternalLink className="size-4" /> פתיחה
                  </a>
                </Button>
              )}
              {r.resource_type === "text_template" && r.content && (
                <Button variant="secondary" size="sm" onClick={() => copyText(r.content!)}>
                  <Copy className="size-4" /> העתקה
                </Button>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
