import { Fragment, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Building2,
  Clock,
  Eye,
  Mail,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/ui/copy-button";
import { sendInvite } from "@/lib/invite";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectMenu } from "@/components/ui/select-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/sheet";
import { supabase } from "@/lib/supabase";
import { toast, toastError } from "@/hooks/use-toast";
import { clampText } from "@/lib/sanitize";
import { GENDER_OPTIONS } from "@/lib/gender";
import { useClients } from "@/hooks/useClients";
import { isDemoEmail } from "@/lib/demo";
import { isInternalClient } from "@/lib/internal";
import { DemoAccountControls } from "@/components/admin/DemoAccountControls";
import { useClientCrm } from "@/hooks/useClientCrm";
import { resolveOrgPrimaryClientId } from "@/hooks/useClientBrand";
import { resolveClientOrgId } from "@/hooks/useOrg";
import { useAuth } from "@/hooks/useAuth";
import type { ClientCallLog } from "@/types/database";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function waLink(phone: string) {
  const digits = phone.replace(/\D/g, "").replace(/^0/, "972");
  return `https://wa.me/${digits}`;
}

type ClientItem = {
  kind: "active" | "pending";
  id: string | null; // profile id (active only)
  email: string;
  full_name: string | null;
  business_name: string | null;
  phone: string | null;
  enrolled: boolean; // approved into the referral program
  inviteSentAt: string | null; // last welcome-email send (pending invitees)
  lastSeen?: string | null; // last real login (active clients)
};

type SortKey = "name" | "activity";
type SortDir = "asc" | "desc";
type Sort = { key: SortKey; dir: SortDir };

/** Unified "last activity" instant for sorting: last real login for active
 * clients, last invite-sent for pending ones. Nullable, sorts last. */
function activityValue(item: ClientItem): string {
  return (item.kind === "active" ? item.lastSeen : item.inviteSentAt) ?? "";
}

function sortClients(rows: ClientItem[], sort: Sort): ClientItem[] {
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (sort.key === "name") {
      const an = a.business_name || a.full_name || a.email;
      const bn = b.business_name || b.full_name || b.email;
      return sign * an.localeCompare(bn, "he");
    }
    return sign * activityValue(a).localeCompare(activityValue(b));
  });
}

function SortableTh({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <th className="px-3 py-2 text-start font-medium">
      <button
        type="button"
        onClick={onClick}
        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
      >
        {label}
        {active ? (
          dir === "asc" ? (
            <ArrowUp className="size-3" />
          ) : (
            <ArrowDown className="size-3" />
          )
        ) : (
          <ArrowUpDown className="size-3 opacity-40" />
        )}
      </button>
    </th>
  );
}

function ClientTableRow({
  item,
  onEdit,
  onDelete,
}: {
  item: ClientItem;
  onEdit: (i: ClientItem) => void;
  onDelete: (i: ClientItem) => void;
}) {
  const qc = useQueryClient();
  const [resending, setResending] = useState(false);

  const Icon = item.kind === "active" ? Building2 : Clock;
  const iconClass =
    item.kind === "active" ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground";
  const badge =
    item.kind === "active" ? (
      item.enrolled ? (
        <Badge variant="cyan">שותף</Badge>
      ) : (
        <Badge variant="success">פעיל</Badge>
      )
    ) : (
      <Badge variant="warning">ממתין</Badge>
    );

  async function resendInvite() {
    setResending(true);
    const r = await sendInvite(item.email);
    setResending(false);
    if (r.ok) toast({ title: "ההזמנה נשלחה שוב ✓", variant: "success" });
    else toastError("שליחת ההזמנה נכשלה.");
    qc.invalidateQueries({ queryKey: ["clients"] });
  }

  const nameContent = (
    <span className="flex min-w-0 items-center gap-2">
      <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${iconClass}`}>
        <Icon className="size-3.5" />
      </span>
      <span className="truncate font-medium">
        {item.business_name || item.full_name || "ללא שם"}
      </span>
    </span>
  );

  return (
    <tr className="text-foreground">
      <td className="px-3 py-2.5">
        {item.kind === "active" && item.id ? (
          <Link
            to={`/admin/clients/${item.id}`}
            className="flex min-w-0 items-center gap-2 hover:text-primary hover:underline"
          >
            {nameContent}
          </Link>
        ) : (
          nameContent
        )}
      </td>
      <td className="px-3 py-2.5">
        <span className="flex items-center gap-1 font-mono-code text-xs text-muted-foreground">
          <span className="truncate" dir="ltr">
            {item.email}
          </span>
          <CopyButton
            content={item.email}
            variant="ghost"
            size="icon"
            className="size-5 shrink-0 hover:text-foreground"
            toastMessage="האימייל הועתק"
            title="העתקת אימייל"
          />
        </span>
      </td>
      <td className="px-3 py-2.5">{badge}</td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground">
        {item.kind === "active" ? (
          item.lastSeen ? (
            new Date(item.lastSeen).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })
          ) : (
            "טרם נכנס"
          )
        ) : item.inviteSentAt ? (
          <span className="text-brand-green-base">
            ✓ נשלחה · {new Date(item.inviteSentAt).toLocaleDateString("he-IL")}
          </span>
        ) : (
          "טרם נשלחה הזמנה"
        )}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex flex-wrap items-center gap-1">
          {item.kind === "pending" && (
            <Button
              variant="ghost"
              size="icon"
              aria-label={item.inviteSentAt ? "שלח הזמנה שוב" : "שלח הזמנה"}
              title={item.inviteSentAt ? "שלח הזמנה שוב" : "שלח הזמנה"}
              disabled={resending}
              onClick={resendInvite}
            >
              <Mail className="size-4" />
            </Button>
          )}
          {item.kind === "active" && item.id && (
            <Button variant="ghost" size="icon" aria-label="צפייה" asChild>
              <Link to={`/admin/clients/${item.id}`}>
                <Eye className="size-4" />
              </Link>
            </Button>
          )}
          <Button variant="ghost" size="icon" aria-label="עריכה" onClick={() => onEdit(item)}>
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="מחיקה"
            className="text-destructive"
            onClick={() => onDelete(item)}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

function ClientsTable({
  rows,
  sort,
  onSort,
  onEdit,
  onDelete,
  renderExtraRow,
}: {
  rows: ClientItem[];
  sort: Sort;
  onSort: (key: SortKey) => void;
  onEdit: (i: ClientItem) => void;
  onDelete: (i: ClientItem) => void;
  /** Optional full-width row rendered under a given item (e.g. demo-account QA controls). */
  renderExtraRow?: (i: ClientItem) => ReactNode;
}) {
  const sorted = useMemo(() => sortClients(rows, sort), [rows, sort]);

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/60">
            <SortableTh label="לקוח" active={sort.key === "name"} dir={sort.dir} onClick={() => onSort("name")} />
            <th className="px-3 py-2 text-start font-medium text-muted-foreground">אימייל</th>
            <th className="px-3 py-2 text-start font-medium text-muted-foreground">סטטוס</th>
            <SortableTh
              label="פעילות אחרונה"
              active={sort.key === "activity"}
              dir={sort.dir}
              onClick={() => onSort("activity")}
            />
            <th className="px-3 py-2 text-start font-medium text-muted-foreground">פעולות</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60">
          {sorted.map((item) => {
            const extra = renderExtraRow?.(item);
            return (
              <Fragment key={item.id ?? item.email}>
                <ClientTableRow item={item} onEdit={onEdit} onDelete={onDelete} />
                {extra && (
                  <tr className="bg-background/30">
                    <td colSpan={5} className="px-3 pb-3 pt-0">
                      {extra}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function Clients() {
  const { data, isLoading, isError } = useClients();
  const [editTarget, setEditTarget] = useState<ClientItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientItem | null>(null);
  const [sort, setSort] = useState<Sort>({ key: "name", dir: "asc" });

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  // Authoritative last-login per user (from auth.users), for the "כניסה אחרונה" line.
  const { data: activity } = useQuery({
    queryKey: ["admin-user-activity"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_user_activity");
      // Surface RPC failures instead of silently showing everyone as "טרם נכנס".
      if (error) throw error;
      const m = new Map<string, string>();
      for (const a of (data ?? []) as { id: string; last_sign_in_at: string | null }[]) {
        if (a.last_sign_in_at) m.set(a.id, a.last_sign_in_at);
      }
      return m;
    },
  });

  const activeList = data?.active ?? [];
  const pendingList = data?.pending ?? [];
  const realActive = activeList.filter((c) => !isDemoEmail(c.email) && !isInternalClient(c.email));
  const internalActive = activeList.filter((c) => isInternalClient(c.email));
  const demoActive = activeList.filter((c) => isDemoEmail(c.email));
  const realPending = pendingList.filter((c) => !isDemoEmail(c.email) && !isInternalClient(c.email));
  const demoPending = pendingList.filter((c) => isDemoEmail(c.email));
  const hasDemo = demoActive.length + demoPending.length > 0;

  const toActiveItem = (c: (typeof activeList)[number]): ClientItem => ({
    kind: "active",
    id: c.id,
    email: c.email,
    full_name: c.full_name,
    business_name: c.business_name,
    phone: c.phone,
    enrolled: c.enrolled,
    inviteSentAt: null,
    lastSeen: activity?.get(c.id) ?? null,
  });
  const toPendingItem = (c: (typeof pendingList)[number]): ClientItem => ({
    kind: "pending",
    id: null,
    email: c.email,
    full_name: c.full_name,
    business_name: c.business_name,
    phone: null,
    enrolled: false,
    inviteSentAt: c.invite_sent_at,
  });

  const realActiveRows = realActive.map(toActiveItem);
  const realPendingRows = realPending.map(toPendingItem);
  const internalActiveRows = internalActive.map(toActiveItem);
  const demoActiveRows = demoActive.map(toActiveItem);
  const demoPendingRows = demoPending.map(toPendingItem);

  return (
    <div>
      <PageHeader
        title="לקוחות"
        subtitle="הלקוחות שלך, מי שכבר נכנס ומי שעוד מחכה לכניסה ראשונה."
        actions={<AddClientDialog />}
      />

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <EmptyState icon={Users} title="טעינת הלקוחות נכשלה" />
      ) : !data?.active.length && !data?.pending.length ? (
        <EmptyState
          icon={Users}
          title="אין עדיין לקוחות"
          description="הוסף לקוח ראשון, וברגע שהוא יתחבר הוא יופיע כאן."
          action={<AddClientDialog />}
        />
      ) : (
        <div className="space-y-6">
          {realActiveRows.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                פעילים ({realActiveRows.length})
              </h2>
              <ClientsTable
                rows={realActiveRows}
                sort={sort}
                onSort={toggleSort}
                onEdit={setEditTarget}
                onDelete={setDeleteTarget}
              />
            </section>
          )}

          {realPendingRows.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-medium text-muted-foreground">
                ממתינים לכניסה ראשונה ({realPendingRows.length})
              </h2>
              <ClientsTable
                rows={realPendingRows}
                sort={sort}
                onSort={toggleSort}
                onEdit={setEditTarget}
                onDelete={setDeleteTarget}
              />
            </section>
          )}

          {internalActiveRows.length > 0 && (
            <section className="space-y-2 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-3">
              <h2 className="text-sm font-medium text-primary">
                סטודיו (פנימי) , לזמן על Orion / Chat / אדמיניסטרציה, לא נספר כלקוח
              </h2>
              <ClientsTable
                rows={internalActiveRows}
                sort={sort}
                onSort={toggleSort}
                onEdit={setEditTarget}
                onDelete={setDeleteTarget}
              />
            </section>
          )}

          {hasDemo && (
            <section className="space-y-2 rounded-2xl border border-dashed border-border/60 bg-background/20 p-3">
              <h2 className="text-sm font-medium text-amber-500">
                טסטים (דמה) , לא נספרים כלקוחות אמיתיים
              </h2>
              {demoActiveRows.length > 0 && (
                <ClientsTable
                  rows={demoActiveRows}
                  sort={sort}
                  onSort={toggleSort}
                  onEdit={setEditTarget}
                  onDelete={setDeleteTarget}
                  renderExtraRow={(item) =>
                    item.id ? (
                      <DemoAccountControls
                        demoId={item.id}
                        role="client"
                        sources={realActive.map((r) => ({
                          id: r.id,
                          label: r.full_name || r.business_name || r.email,
                        }))}
                      />
                    ) : null
                  }
                />
              )}
              {demoPendingRows.length > 0 && (
                <>
                  <ClientsTable
                    rows={demoPendingRows}
                    sort={sort}
                    onSort={toggleSort}
                    onEdit={setEditTarget}
                    onDelete={setDeleteTarget}
                  />
                  <p className="ps-1 text-xs text-muted-foreground">
                    התחבר פעם אחת עם חשבון הדמה כדי להפעיל את טעינת הנתונים.
                  </p>
                </>
              )}
            </section>
          )}
        </div>
      )}

      <EditClientDialog
        target={editTarget}
        onClose={() => setEditTarget(null)}
      />
      <DeleteClientDialog
        target={deleteTarget}
        onClose={() => setDeleteTarget(null)}
      />
    </div>
  );
}

function EditClientDialog({
  target,
  onClose,
}: {
  target: ClientItem | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const isActive = target?.kind === "active";
  const crm = useClientCrm(isActive ? target!.id : null);

  const [form, setForm] = useState({
    full_name: "",
    email: "",
    business_name: "",
    phone: "",
    enrolled: false,
    gender: "" as "" | "male" | "female" | "other",
    role_in_company: "",
    personal_info: "",
  });
  const [seeded, setSeeded] = useState<string | null>(null);
  const [crmSeeded, setCrmSeeded] = useState<string | null>(null);

  // Seed the basic fields once per opened target.
  const key = target ? `${target.kind}:${target.email}` : null;
  if (target && key !== seeded) {
    setForm((f) => ({
      ...f,
      full_name: target.full_name ?? "",
      email: target.email,
      business_name: target.business_name ?? "",
      phone: target.phone ?? "",
      enrolled: target.enrolled,
    }));
    setSeeded(key);
  }
  // Seed the admin-private CRM fields once loaded.
  if (isActive && crm.data && target!.id !== crmSeeded) {
    setForm((f) => ({
      ...f,
      gender: (crm.data!.note?.gender ?? "") as typeof f.gender,
      role_in_company: crm.data!.note?.role_in_company ?? "",
      personal_info: crm.data!.note?.content ?? "",
    }));
    setCrmSeeded(target!.id);
  }

  function update(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    if (!target) return;
    setSaving(true);
    let noteOrgId: string | null = null;
    try {
      if (target.kind === "pending") {
        const email = form.email.trim().toLowerCase();
        if (!EMAIL_RE.test(email)) {
          toastError("כתובת אימייל לא תקינה.");
          return;
        }
        const { error } = await supabase
          .from("allowed_emails")
          .update({
            email,
            full_name: clampText(form.full_name.trim(), 120) || null,
            business_name: clampText(form.business_name.trim(), 120) || null,
          })
          .eq("email", target.email);
        if (error) throw error;
      } else {
        const { error: pErr } = await supabase
          .from("profiles")
          .update({
            full_name: clampText(form.full_name.trim(), 120) || null,
            phone: clampText(form.phone.trim(), 40) || null,
          })
          .eq("id", target.id!);
        if (pErr) throw pErr;
        // Business name lives on the org's single primary client_brand row -
        // resolve it so quick-editing from a non-primary member's row edits
        // (and never duplicates) the business's one brand row.
        const brandTarget = await resolveOrgPrimaryClientId(target.id!);
        const { error: bErr } = await supabase.from("client_brand").upsert(
          {
            client_id: brandTarget.clientId,
            ...(brandTarget.orgId ? { org_id: brandTarget.orgId, is_org_primary: true } : {}),
            business_name: clampText(form.business_name.trim(), 120) || null,
          },
          { onConflict: "client_id" }
        );
        if (bErr) throw bErr;

        // Admin-private CRM info. org_id is this member's OWN org (not the
        // brand's primary-row target above) - the note is per person, one row
        // per client_id, so it's stamped with whichever org this person
        // belongs to (Task 11: CRM reads by org_id on Business Detail).
        noteOrgId = await resolveClientOrgId(target.id!);
        const { error: nErr } = await supabase
          .from("admin_client_notes")
          .upsert(
            {
              client_id: target.id!,
              org_id: noteOrgId,
              gender: form.gender || null,
              role_in_company: clampText(form.role_in_company.trim(), 120) || null,
              content: clampText(form.personal_info.trim(), 4000) || null,
            },
            { onConflict: "client_id" }
          );
        if (nErr) throw nErr;

        // Mirror gender onto the profile so the client-facing copy can be gendered
        // (admin_client_notes is admin-only and can't be read by the client).
        const { error: gErr } = await supabase
          .from("profiles")
          .update({ gender: form.gender || null })
          .eq("id", target.id!);
        if (gErr) throw gErr;

        // Approve / revoke the referral program for this client.
        if (form.enrolled && !target.enrolled) {
          await supabase
            .from("partner_enrollments")
            .insert({ client_id: target.id!, terms_version: "v1" });
        } else if (!form.enrolled && target.enrolled) {
          await supabase.from("partner_enrollments").delete().eq("client_id", target.id!);
        }
      }
      toast({ title: "הפרטים עודכנו", variant: "success" });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      qc.invalidateQueries({ queryKey: ["client-crm", target.id] });
      if (noteOrgId) qc.invalidateQueries({ queryKey: ["org-notes", noteOrgId] });
      onClose();
    } catch {
      toastError("העדכון נכשל.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>עריכת לקוח</DialogTitle>
          <DialogDescription>
            {target?.kind === "active"
              ? "עדכון שם הלקוח ושם העסק."
              : "עדכון הפרטים לפני הכניסה הראשונה."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="e-name">שם מלא</Label>
            <Input
              id="e-name"
              value={form.full_name}
              maxLength={120}
              onChange={(e) => update("full_name", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-email">אימייל (Google או כל מייל)</Label>
            <Input
              id="e-email"
              dir="ltr"
              type="email"
              value={form.email}
              disabled={target?.kind === "active"}
              onChange={(e) => update("email", e.target.value)}
            />
            {target?.kind === "active" && (
              <p className="text-xs text-muted-foreground">
                לא ניתן לשנות אימייל של לקוח שכבר התחבר.
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="e-business">שם העסק</Label>
            <Input
              id="e-business"
              value={form.business_name}
              maxLength={120}
              onChange={(e) => update("business_name", e.target.value)}
            />
          </div>

          {isActive && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="e-phone">טלפון</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="e-phone"
                    dir="ltr"
                    value={form.phone}
                    maxLength={40}
                    onChange={(e) => update("phone", e.target.value)}
                    placeholder="05X-XXXXXXX"
                  />
                  {form.phone.trim() && (
                    <Button variant="secondary" size="icon" asChild aria-label="וואטסאפ">
                      <a href={waLink(form.phone)} target="_blank" rel="noreferrer noopener">
                        <MessageCircle className="size-4 text-brand-green-base" />
                      </a>
                    </Button>
                  )}
                  {form.phone.trim() && (
                    <Button variant="secondary" size="icon" asChild aria-label="חיוג">
                      <a href={`tel:${form.phone.replace(/\s/g, "")}`}>
                        <Phone className="size-4" />
                      </a>
                    </Button>
                  )}
                  <Button variant="secondary" size="icon" asChild aria-label="מייל">
                    <a
                      href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(target!.email)}`}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      <Mail className="size-4" />
                    </a>
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="e-gender">מין</Label>
                  <SelectMenu
                    id="e-gender"
                    variant="field"
                    ariaLabel="מין"
                    value={form.gender}
                    onChange={(v) => update("gender", v)}
                    options={[
                      { value: "", label: "לא צוין" },
                      { value: "male", label: "זכר" },
                      { value: "female", label: "נקבה" },
                      { value: "other", label: "אחר" },
                    ]}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="e-role">תפקיד בחברה</Label>
                  <Input
                    id="e-role"
                    value={form.role_in_company}
                    maxLength={120}
                    onChange={(e) => update("role_in_company", e.target.value)}
                    placeholder="מנכ״לית, בעלים…"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="e-personal">מידע אישי (פרטי לאדמין)</Label>
                <Textarea
                  id="e-personal"
                  value={form.personal_info}
                  maxLength={4000}
                  onChange={(e) => update("personal_info", e.target.value)}
                  placeholder="שם בן/בת הזוג, ילדים, תחביבים, וכל מה שעוזר לי ליחס אישי…"
                />
              </div>

              <CallLogSection clientId={target!.id!} calls={crm.data?.calls ?? []} />
            </>
          )}

          {isActive && (
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background/30 p-3">
              <input
                type="checkbox"
                checked={form.enrolled}
                onChange={(e) => setForm((f) => ({ ...f, enrolled: e.target.checked }))}
                className="mt-0.5 size-4 accent-[var(--primary)]"
              />
              <span className="text-sm">
                <span className="font-medium text-foreground">אישור לתוכנית השותפים</span>
                <span className="mt-0.5 block text-xs text-muted-foreground">
                  רק אחרי אישור הלקוח יראה את תוכנית השותפים (הפניות וקרדיטים).
                </span>
              </span>
            </label>
          )}
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={saving}>
            {saving ? "שומר…" : "שמירה"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteClientDialog({
  target,
  onClose,
}: {
  target: ClientItem | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  async function confirmDelete() {
    if (!target) return;
    setBusy(true);
    try {
      if (target.kind === "active") {
        // Removes the client and cascades their projects/files/etc.
        const { error } = await supabase.from("profiles").delete().eq("id", target.id!);
        if (error) throw error;
      }
      // In both cases drop the whitelist entry so access is revoked.
      await supabase
        .from("allowed_emails")
        .delete()
        .ilike("email", target.email);

      toast({ title: "הלקוח הוסר", variant: "success" });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      onClose();
    } catch {
      toastError("המחיקה נכשלה.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>מחיקת לקוח</DialogTitle>
          <DialogDescription>
            {target?.kind === "active"
              ? "פעולה זו תמחק את הלקוח ואת כל הפרויקטים, הקבצים וההודעות שלו. אי אפשר לבטל."
              : "פעולה זו תסיר את ההזמנה. הלקוח לא יוכל להתחבר עד שתוסיף אותו שוב."}
          </DialogDescription>
        </DialogHeader>

        <p className="rounded-xl border border-border bg-muted px-3 py-2 text-sm text-foreground">
          {target?.business_name || target?.full_name || target?.email}
        </p>

        <DialogFooter>
          <Button variant="destructive" onClick={confirmDelete} disabled={busy}>
            <Trash2 className="size-4" />
            {busy ? "מוחק…" : "מחיקה"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CallLogSection({ clientId, calls }: { clientId: string; calls: ClientCallLog[] }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);

  async function add() {
    const summary = clampText(text.trim(), 2000);
    if (!summary) return;
    setAdding(true);
    // Stamp org_id (Task 10/11: client_call_logs.org_id, read org-scoped on
    // Business Detail) so this call log shows up there, not just here.
    const orgId = await resolveClientOrgId(clientId);
    const { error } = await supabase
      .from("client_call_logs")
      .insert({ client_id: clientId, org_id: orgId, summary, created_by: user?.id ?? null });
    setAdding(false);
    if (error) return toastError("הוספת הסיכום נכשלה.");
    setText("");
    qc.invalidateQueries({ queryKey: ["client-crm", clientId] });
    if (orgId) qc.invalidateQueries({ queryKey: ["org-call-logs", orgId] });
  }

  return (
    <div className="space-y-2 rounded-xl border border-border bg-background/30 p-3">
      <p className="text-sm font-medium text-foreground">סיכומי שיחות</p>
      <div className="flex items-start gap-2">
        <Textarea
          value={text}
          maxLength={2000}
          onChange={(e) => setText(e.target.value)}
          placeholder="סיכום השיחה האחרונה…"
          className="min-h-16"
        />
        <Button size="sm" onClick={add} disabled={adding}>
          {adding ? "מוסיף…" : "הוספה"}
        </Button>
      </div>
      {calls.length > 0 && (
        <ul className="space-y-2 pt-1">
          {calls.map((c) => (
            <li key={c.id} className="rounded-lg bg-card px-3 py-2">
              <p className="whitespace-pre-wrap text-sm text-foreground">{c.summary}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(c.created_at).toLocaleString("he-IL")}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddClientDialog() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    business_name: "",
    gender: "" as "" | "male" | "female" | "other",
  });

  function update(k: keyof typeof form, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save() {
    const email = form.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      toastError("כתובת אימייל לא תקינה.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("allowed_emails").insert({
      email,
      role: "client",
      full_name: clampText(form.full_name.trim(), 120) || null,
      business_name: clampText(form.business_name.trim(), 120) || null,
      gender: form.gender || null,
    });
    setSaving(false);

    if (error) {
      toastError(
        error.code === "23505" ? "הלקוח כבר קיים במערכת." : "הוספת הלקוח נכשלה."
      );
      return;
    }

    // Auto-send the "ברוכים הבאים ל-Orion" invitation (non-blocking).
    const invite = await sendInvite(email);
    if (invite.ok) {
      toast({ title: "הלקוח נוסף וההזמנה נשלחה למייל ✓", variant: "success" });
    } else {
      toast({
        title: "הלקוח נוסף, שליחת ההזמנה נכשלה",
        description: "אפשר לשלוח שוב מרשימת הממתינים.",
        variant: "destructive",
      });
    }
    qc.invalidateQueries({ queryKey: ["clients"] });
    setForm({ full_name: "", email: "", business_name: "", gender: "" });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> הוספת לקוח
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>הוספת לקוח חדש</DialogTitle>
          <DialogDescription>
            הזן את כתובת המייל של הלקוח (Google או כל מייל). ברגע שהוא מתחבר בפעם
            הראשונה, הפרופיל שלו נוצר אוטומטית.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="c-name">שם מלא</Label>
            <Input
              id="c-name"
              value={form.full_name}
              maxLength={120}
              onChange={(e) => update("full_name", e.target.value)}
              placeholder="שם הלקוח"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-email">אימייל (Google או כל מייל)</Label>
            <Input
              id="c-email"
              dir="ltr"
              type="email"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder="client@gmail.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-business">שם העסק</Label>
            <Input
              id="c-business"
              value={form.business_name}
              maxLength={120}
              onChange={(e) => update("business_name", e.target.value)}
              placeholder="שם העסק של הלקוח"
            />
          </div>
          <div className="space-y-1.5">
            <Label>מין (להתאמת ניסוח)</Label>
            <SelectMenu
              variant="field"
              ariaLabel="מין"
              value={form.gender}
              onChange={(v) => update("gender", v)}
              options={GENDER_OPTIONS}
            />
          </div>
        </div>

        <DialogFooter>
          <Button onClick={save} disabled={saving}>
            <UserPlus className="size-4" />
            {saving ? "מוסיף…" : "הוספה"}
          </Button>
          <Button variant="ghost" onClick={() => setOpen(false)}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
