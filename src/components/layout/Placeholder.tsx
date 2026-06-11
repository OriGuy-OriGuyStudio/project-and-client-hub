import { Construction } from "lucide-react";
import { PageHeader } from "./PageHeader";
import { EmptyState } from "@/components/ui/empty-state";

/** Temporary page for deferred-backlog features. */
export function Placeholder({ title }: { title: string }) {
  return (
    <div>
      <PageHeader title={title} />
      <EmptyState
        icon={Construction}
        title="בקרוב"
        description="האזור הזה ייבנה בשלב הבא של הפיתוח."
      />
    </div>
  );
}
