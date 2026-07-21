import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Mail, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/copy-button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { supabase } from "@/lib/supabase";
import { toast, toastError } from "@/hooks/use-toast";
import type { AgreementAddendum } from "@/types/database";

const MAX_TITLE_LEN = 200;

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Per-agreement "נספחים" sub-section (Client Detail admin page). A signed
 * service agreement is a frozen snapshot, so a term that needs to change after
 * signing goes through a standalone addendum instead of rewriting it , its own
 * sign link + signature, locked once signed. Add/edit is a side Sheet, list +
 * actions inline. See supabase/migrations/20260720120000_agreement_addenda.sql.
 */
export function AgreementAddendaSection({ agreementId }: { agreementId: string }) {
  const qc = useQueryClient();
  const queryKey = ["agreement-addenda", agreementId];

  const { data: addenda = [], isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<AgreementAddendum[]> => {
      const { data, error } = await supabase.rpc("admin_agreement_addenda", {
        p_agreement_id: agreementId,
      });
      if (error) throw error;
      return (data as AgreementAddendum[] | null) ?? [];
    },
  });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<AgreementAddendum | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  function refresh() {
    qc.invalidateQueries({ queryKey });
  }

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }
  function openEdit(a: AgreementAddendum) {
    setEditing(a);
    setSheetOpen(true);
  }

  async function sendEmail(id: string) {
    setSendingId(id);
    const { data, error } = await supabase.rpc("admin_send_addendum", { p_id: id });
    setSendingId(null);
    if (error) return toastError(error.message || "השליחה נכשלה.");
    const result = data as { ok: boolean; error?: string };
    if (!result?.ok) return toastError("השליחה נכשלה, הנספח לא נמצא.");
    toast({ title: "נשלח ללקוח", variant: "success" });
  }

  async function deleteAddendum(id: string) {
    const { data, error } = await supabase.rpc("admin_delete_addendum", { p_id: id });
    if (error) return toastError(error.message || "המחיקה נכשלה.");
    const result = data as { ok: boolean; error?: string };
    if (!result?.ok) return toastError("אפשר למחוק רק נספח שממתין לחתימה.");
    toast({ title: "הנספח נמחק", variant: "success" });
    refresh();
  }

  return (
    <div className="mt-3 border-t border-border/60 pt-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-muted-foreground">נספחים</p>
        <Button variant="ghost" size="sm" onClick={openCreate}>
          <Plus className="ml-1 size-3.5" /> הוסף נספח
        </Button>
      </div>

      {isLoading ? (
        <p className="mt-2 text-xs text-muted-foreground">טוען…</p>
      ) : addenda.length === 0 ? (
        <p className="mt-2 text-xs text-muted-foreground">אין נספחים להסכם הזה.</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {addenda.map((ad) => {
            const pending = ad.status === "pending";
            const expanded = expandedId === ad.id;
            return (
              <li
                key={ad.id}
                className="rounded-lg border border-border/70 bg-background/20 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="font-medium text-foreground">{ad.title}</span>
                    <Badge variant={pending ? "warning" : "success"} className="mr-2 align-middle">
                      {pending ? "ממתין לחתימה" : "נחתם"}
                    </Badge>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      נוצר ב-{fmtDateTime(ad.created_at)}
                      {!pending && ad.signed_at && (
                        <> · נחתם ע״י {ad.signer_name || "הלקוח"} ב-{fmtDateTime(ad.signed_at)}</>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    {pending ? (
                      <>
                        <CopyButton
                          content={`${window.location.origin}/addendum/${ad.sign_token}`}
                          label="העתק קישור"
                          size="sm"
                          variant="ghost"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={sendingId === ad.id}
                          onClick={() => sendEmail(ad.id)}
                        >
                          <Mail className="ml-1 size-3.5" />
                          {sendingId === ad.id ? "שולח…" : "שלח ללקוח במייל"}
                        </Button>
                        <Button variant="ghost" size="icon" aria-label="עריכת נספח" onClick={() => openEdit(ad)}>
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="מחיקת נספח"
                          onClick={() => setConfirmDeleteId(ad.id)}
                        >
                          <Trash2 className="size-3.5 text-destructive" />
                        </Button>
                      </>
                    ) : (
                      <Button variant="ghost" size="sm" onClick={() => setExpandedId(expanded ? null : ad.id)}>
                        <Eye className="ml-1 size-3.5" /> צפייה
                      </Button>
                    )}
                  </div>
                </div>
                {expanded && (
                  <p className="mt-2 whitespace-pre-wrap rounded-lg border border-border/50 bg-background/30 p-2.5 text-xs text-muted-foreground">
                    {ad.body}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <AddendumFormSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        agreementId={agreementId}
        editing={editing}
        onSaved={refresh}
      />

      <ConfirmDialog
        open={!!confirmDeleteId}
        onOpenChange={(o) => !o && setConfirmDeleteId(null)}
        title="מחיקת נספח"
        description="הפעולה תמחק את הנספח לצמיתות. אפשר למחוק רק נספח שעדיין ממתין לחתימה."
        confirmLabel="מחיקה"
        onConfirm={() => confirmDeleteId && deleteAddendum(confirmDeleteId)}
      />
    </div>
  );
}

function AddendumFormSheet({
  open,
  onClose,
  agreementId,
  editing,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  agreementId: string;
  editing: AgreementAddendum | null;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  // Sync fields whenever the sheet opens (fresh create, or prefilled edit).
  useEffect(() => {
    if (!open) return;
    setTitle(editing?.title ?? "");
    setBody(editing?.body ?? "");
  }, [open, editing]);

  async function save() {
    if (!title.trim() || !body.trim()) return toastError("צריך למלא כותרת ונוסח.");
    setSaving(true);

    if (editing) {
      const { data, error } = await supabase.rpc("admin_update_addendum", {
        p_id: editing.id,
        p_title: title.trim(),
        p_body: body.trim(),
      });
      setSaving(false);
      if (error) return toastError(error.message || "העדכון נכשל.");
      const result = data as { ok: boolean; error?: string };
      if (!result?.ok) return toastError("אפשר לערוך רק נספח שממתין לחתימה.");
      toast({ title: "הנספח עודכן", variant: "success" });
    } else {
      const { data, error } = await supabase.rpc("admin_create_addendum", {
        p_agreement_id: agreementId,
        p_title: title.trim(),
        p_body: body.trim(),
      });
      setSaving(false);
      if (error) return toastError(error.message || "היצירה נכשלה.");
      const result = data as { ok: boolean; error?: string };
      if (!result?.ok) return toastError("היצירה נכשלה.");
      toast({ title: "הנספח נוצר", variant: "success" });
    }

    onSaved();
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{editing ? "עריכת נספח" : "נספח חדש"}</SheetTitle>
          <SheetDescription>
            נספח הוא מסמך קטן ועצמאי המקושר להסכם השירות, עם קישור חתימה משלו. לאחר חתימה הוא ננעל ולא ניתן לעריכה.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="addendum-title">כותרת</Label>
            <Input
              id="addendum-title"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE_LEN))}
              maxLength={MAX_TITLE_LEN}
              placeholder="לדוגמה: תוספת ניהול דומיין"
              disabled={saving}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="addendum-body">נוסח הנספח</Label>
            <Textarea
              id="addendum-body"
              autoGrow
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="נוסח הסעיף שהלקוח יקרא ויחתום עליו…"
              disabled={saving}
            />
          </div>
        </div>

        <SheetFooter>
          <Button onClick={save} disabled={saving}>
            {saving ? "שומר…" : editing ? "שמירה" : "יצירה"}
          </Button>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            ביטול
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
