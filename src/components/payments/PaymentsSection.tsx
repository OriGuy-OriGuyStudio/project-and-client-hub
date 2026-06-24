import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CreditCard, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { supabase } from "@/lib/supabase";
import { toastError } from "@/hooks/use-toast";
import { clampText } from "@/lib/sanitize";
import { paymentStatusHe } from "@/lib/status";
import { cn } from "@/lib/utils";
import { useNotifyClient } from "@/components/project/NotifyClient";
import type { Payment } from "@/types/database";

export function PaymentsSection({
  projectId,
  isAdmin,
}: {
  projectId: string;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const { requestNotify } = useNotifyClient();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ label: "", amount: "", due_date: "", payment_link: "" });

  const { data: payments, isLoading } = useQuery({
    queryKey: ["payments", projectId],
    queryFn: async (): Promise<Payment[]> => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("project_id", projectId)
        .order("due_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["payments", projectId] });
  const nextPending = payments?.find((p) => p.status === "pending");

  function resetForm() {
    setForm({ label: "", amount: "", due_date: "", payment_link: "" });
    setEditId(null);
    setOpen(false);
  }

  function startEdit(p: Payment) {
    setForm({
      label: p.label,
      amount: p.amount != null ? String(p.amount) : "",
      due_date: p.due_date ?? "",
      payment_link: p.payment_link ?? "",
    });
    setEditId(p.id);
    setOpen(true);
  }

  // Open the panel for a brand-new payment (clearing any in-progress edit).
  function toggleAdd() {
    if (open) return resetForm();
    setForm({ label: "", amount: "", due_date: "", payment_link: "" });
    setEditId(null);
    setOpen(true);
  }

  async function savePayment() {
    const label = clampText(form.label.trim(), 160);
    if (!label) return toastError("תן שם לתשלום.");
    const payload = {
      label,
      amount: form.amount ? Number(form.amount) : null,
      due_date: form.due_date || null,
      payment_link: clampText(form.payment_link.trim(), 500) || null,
    };

    if (editId) {
      const { error } = await supabase.from("payments").update(payload).eq("id", editId);
      if (error) return toastError("עדכון התשלום נכשל.");
      resetForm();
      refresh();
      return;
    }

    const { error } = await supabase
      .from("payments")
      .insert({ project_id: projectId, ...payload });
    if (error) return toastError("הוספת התשלום נכשלה.");
    const amountText = form.amount ? ` · ₪${Number(form.amount).toLocaleString("he-IL")}` : "";
    resetForm();
    refresh();
    requestNotify({
      type: "payment",
      title: "תשלום חדש ממתין לך",
      body: `${label}${amountText}`,
    });
  }

  async function togglePaid(p: Payment) {
    const paid = p.status !== "paid";
    const { error } = await supabase
      .from("payments")
      .update({ status: paid ? "paid" : "pending", paid_at: paid ? new Date().toISOString() : null })
      .eq("id", p.id);
    if (error) return toastError("העדכון נכשל.");
    refresh();
  }

  async function remove(p: Payment) {
    const { error } = await supabase.from("payments").delete().eq("id", p.id);
    if (error) return toastError("המחיקה נכשלה.");
    refresh();
  }

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <CreditCard className="size-5 text-brand-cyan-base" />
          <h2 className="font-heading text-lg font-semibold text-foreground">תשלומים</h2>
        </div>
        {isAdmin && (
          <Button size="sm" variant="ghost" onClick={toggleAdd}>
            <Plus className="size-4" /> תשלום
          </Button>
        )}
      </div>

      {isAdmin && open && (
        <div className="mb-4 space-y-2 rounded-xl border border-border bg-background/30 p-3">
          <Input
            placeholder="שם התשלום (לדוגמה: מקדמה)"
            maxLength={160}
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-2">
            <Input
              dir="ltr"
              type="number"
              placeholder="סכום ₪"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            />
            <Input
              dir="ltr"
              type="date"
              value={form.due_date}
              onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))}
            />
          </div>
          <Input
            dir="ltr"
            placeholder="קישור לתשלום (Bit / PayBox)"
            value={form.payment_link}
            onChange={(e) => setForm((f) => ({ ...f, payment_link: e.target.value }))}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={resetForm}>
              ביטול
            </Button>
            <Button size="sm" onClick={savePayment}>
              {editId ? "שמירה" : "הוספה"}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-20 w-full rounded-xl" />
      ) : !payments?.length ? (
        <EmptyState icon={CreditCard} title="אין עדיין תשלומים" />
      ) : (
        <div className="space-y-2">
          {payments.map((p) => {
            const isNext = !isAdmin && p.id === nextPending?.id;
            return (
              <div
                key={p.id}
                className={cn(
                  "flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3",
                  isNext
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-background/30"
                )}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-foreground">
                    {p.label}
                    {isNext && (
                      <span className="ms-2 text-xs text-primary">התשלום הבא</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.amount != null ? `₪${p.amount.toLocaleString("he-IL")}` : "-"}
                    {p.due_date
                      ? ` · עד ${new Date(p.due_date).toLocaleDateString("he-IL")}`
                      : ""}
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2 ps-0 sm:ps-0">
                  {p.payment_link && p.status !== "paid" && (
                    <>
                      <Button variant="secondary" size="sm" asChild>
                        <a href={p.payment_link} target="_blank" rel="noreferrer noopener">
                          תשלום <ExternalLink className="size-3.5" />
                        </a>
                      </Button>
                      <CopyButton
                        content={p.payment_link}
                        variant="ghost"
                        size="icon"
                        className="size-8 hover:text-foreground"
                        toastMessage="לינק התשלום הועתק"
                        title="העתקת לינק תשלום"
                      />
                    </>
                  )}
                  <Badge variant={p.status === "paid" ? "success" : "warning"}>
                    {paymentStatusHe[p.status]}
                  </Badge>
                  {isAdmin && (
                    <>
                      <Button size="sm" variant="ghost" onClick={() => togglePaid(p)}>
                        {p.status === "paid" ? "בטל" : "סמן שולם"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="עריכה"
                        onClick={() => startEdit(p)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        aria-label="מחיקה"
                        onClick={() => remove(p)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
