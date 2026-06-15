import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Calculator,
  ChevronDown,
  ChevronUp,
  Clock,
  Coins,
  Gift,
  Package,
  Pencil,
  Plus,
  Repeat,
  Sparkles,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectMenu } from "@/components/ui/select-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { REWARD_ICON_KEYS, REWARD_ICONS, rewardIconFor } from "@/components/rewards/reward-icons";
import { supabase } from "@/lib/supabase";
import { toast, toastError } from "@/hooks/use-toast";
import { clampText } from "@/lib/sanitize";
import { monetaryValue } from "@/lib/rewards";
import type { Reward } from "@/types/database";

type Audience = Reward["audience"];
type Kind = Reward["kind"];
type RepeatPolicy = "one_time" | "repeatable" | "cooldown";

const AUDIENCE_LABEL: Record<Audience, string> = {
  client: "לקוחות",
  partner: 'שת"פים',
  both: 'לקוחות + שת"פים',
};
const KIND_LABEL: Record<Kind, string> = {
  generic: "פרס רגיל",
  payout: "המרה לתשלום",
  commission_boost: "בוסט עמלה",
};

/** coins = round(gift ₪ / ₪-per-coin), at least 1. */
export function ilsToCoins(ils: number, ilsPerCoin: number): number {
  if (!(ils > 0) || !(ilsPerCoin > 0)) return 0;
  return Math.max(1, Math.round(ils / ilsPerCoin));
}

function repeatLabel(days: number | null): string {
  if (days == null) return "חד-פעמי";
  if (days === 0) return "ניתן לחזרה";
  return `המתנה ${days} ימים`;
}

/** Sort a group the same way the live store does: featured first, then sort_order, then cost. */
function storeSort(items: Reward[]): Reward[] {
  return [...items].sort(
    (a, b) =>
      Number(b.is_featured) - Number(a.is_featured) ||
      a.sort_order - b.sort_order ||
      a.credit_cost - b.credit_cost
  );
}

export function RewardsStore({
  rewards,
  ilsPerCoin,
  giftValuePct,
}: {
  rewards: Reward[];
  ilsPerCoin: number;
  giftValuePct: number;
}) {
  const [editing, setEditing] = useState<Reward | "new" | null>(null);

  const groups: { audience: Audience; items: Reward[] }[] = [
    { audience: "client", items: storeSort(rewards.filter((r) => r.audience === "client")) },
    { audience: "partner", items: storeSort(rewards.filter((r) => r.audience === "partner")) },
    { audience: "both", items: storeSort(rewards.filter((r) => r.audience === "both")) },
  ].filter((g) => g.items.length) as { audience: Audience; items: Reward[] }[];

  return (
    <section className="space-y-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Gift className="size-5 text-brand-cyan-base" />
          <h2 className="font-heading text-lg font-bold text-foreground">חנות הפרסים</h2>
        </div>
        <Button variant="secondary" onClick={() => setEditing("new")}>
          <Plus className="size-4" /> פרס חדש
        </Button>
      </div>

      <StoreSettings ilsPerCoin={ilsPerCoin} giftValuePct={giftValuePct} />

      {!rewards.length ? (
        <EmptyState icon={Gift} title="אין עדיין פרסים" />
      ) : (
        <div className="space-y-5">
          {groups.map((g) => (
            <div key={g.audience} className="space-y-2">
              <div className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
                <Users className="size-4" />
                חנות {AUDIENCE_LABEL[g.audience]}
                <span className="text-xs">({g.items.length})</span>
              </div>
              {g.items.length ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  {g.items.map((rw, i) => (
                    <RewardCard
                      key={rw.id}
                      reward={rw}
                      siblings={g.items}
                      index={i}
                      ilsPerCoin={ilsPerCoin}
                      giftValuePct={giftValuePct}
                      onEdit={() => setEditing(rw)}
                    />
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                  אין פרסים בחנות זו
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <RewardSheet
        key={editing === "new" ? "new" : editing?.id ?? "closed"}
        reward={editing === "new" ? null : editing}
        open={editing != null}
        ilsPerCoin={ilsPerCoin}
        giftValuePct={giftValuePct}
        siblingsForNew={editing === "new" ? rewards : undefined}
        onClose={() => setEditing(null)}
      />
    </section>
  );
}

/** ₪-per-coin rate, gift-value %, + a live gift-value → coins calculator. */
function StoreSettings({ ilsPerCoin, giftValuePct }: { ilsPerCoin: number; giftValuePct: number }) {
  const qc = useQueryClient();
  const [rate, setRate] = useState(String(ilsPerCoin));
  const [pct, setPct] = useState(String(giftValuePct));
  const [gift, setGift] = useState("");
  const [saving, setSaving] = useState(false);

  const rateNum = Number(rate);
  const pctNum = Number(pct);
  const giftNum = Number(gift);
  const coins = ilsToCoins(giftNum, rateNum);
  const dirty = (rateNum > 0 && rateNum !== ilsPerCoin) || (pctNum > 0 && pctNum !== giftValuePct);

  async function saveSettings() {
    if (!(rateNum > 0)) return toastError("שווי מטבע חייב להיות גדול מ-0.");
    if (!(pctNum > 0)) return toastError("אחוז השווי חייב להיות גדול מ-0.");
    setSaving(true);
    const { error } = await supabase
      .from("studio_settings")
      .update({ ils_per_coin: rateNum, gift_value_pct: pctNum })
      .eq("id", true);
    setSaving(false);
    if (error) return toastError("שמירת ההגדרות נכשלה.");
    toast({ title: "ההגדרות עודכנו", variant: "success" });
    qc.invalidateQueries({ queryKey: ["admin-referrals"] });
  }

  return (
    <Card className="space-y-4 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Calculator className="size-4 text-primary" />
          <h3 className="font-medium text-foreground">הגדרות חנות</h3>
        </div>
        <Button size="sm" onClick={saveSettings} disabled={saving || !dirty}>
          {saving ? "שומר…" : "שמירה"}
        </Button>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="coin-rate">שווי מטבע אחד (₪)</Label>
          <Input
            id="coin-rate"
            dir="ltr"
            type="number"
            min="0.01"
            step="0.01"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">כמה ₪ שווה מטבע אחד.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="gift-pct">אחוז שווי מתנה (%)</Label>
          <Input
            id="gift-pct"
            dir="ltr"
            type="number"
            min="1"
            max="100"
            value={pct}
            onChange={(e) => setPct(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">השווי בש"ח שמוצג למתנות.</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="gift-calc">מחשבון: שווי מתנה (₪)</Label>
          <Input
            id="gift-calc"
            dir="ltr"
            type="number"
            min="0"
            placeholder="לדוגמה 100"
            value={gift}
            onChange={(e) => setGift(e.target.value)}
          />
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Coins className="size-3.5 text-primary" />
            {giftNum > 0 ? (
              <span>
                = <span className="font-semibold text-foreground">{coins}</span> מטבעות
              </span>
            ) : (
              "₪ → מטבעות"
            )}
          </p>
        </div>
      </div>
    </Card>
  );
}

function RewardCard({
  reward,
  siblings,
  index,
  ilsPerCoin,
  giftValuePct,
  onEdit,
}: {
  reward: Reward;
  siblings: Reward[];
  index: number;
  ilsPerCoin: number;
  giftValuePct: number;
  onEdit: () => void;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const Icon = rewardIconFor(reward);

  async function toggle() {
    const { error } = await supabase
      .from("rewards")
      .update({ is_active: !reward.is_active })
      .eq("id", reward.id);
    if (error) return toastError("העדכון נכשל.");
    qc.invalidateQueries({ queryKey: ["admin-referrals"] });
  }
  async function remove() {
    if (!window.confirm(`למחוק את הפרס "${reward.name}"?`)) return;
    const { error } = await supabase.from("rewards").delete().eq("id", reward.id);
    if (error) return toastError("המחיקה נכשלה (ייתכן שיש מימושים מקושרים).");
    qc.invalidateQueries({ queryKey: ["admin-referrals"] });
  }
  // Reassign sort_order across the whole group after swapping two neighbours.
  async function move(dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= siblings.length || busy) return;
    setBusy(true);
    const reordered = [...siblings];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const { error } = await Promise.all(
      reordered.map((r, i) => supabase.from("rewards").update({ sort_order: i }).eq("id", r.id))
    ).then((res) => res.find((r) => r.error) ?? { error: null });
    setBusy(false);
    if (error) return toastError("שינוי הסדר נכשל.");
    qc.invalidateQueries({ queryKey: ["admin-referrals"] });
  }

  const limited = reward.stock != null;

  return (
    <Card
      className={
        "flex flex-col gap-2 p-4" +
        (reward.is_active ? "" : " opacity-60") +
        (reward.is_featured ? " ring-1 ring-primary/40" : "")
      }
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Icon className="size-4" />
          </span>
          <p className="min-w-0 break-words font-medium text-foreground">{reward.name}</p>
        </div>
        <Badge variant={reward.is_active ? "success" : "secondary"} className="shrink-0">
          <Sparkles className="size-3" /> {reward.credit_cost}
        </Badge>
      </div>
      {reward.description && (
        <p className="line-clamp-2 text-xs text-muted-foreground">{reward.description}</p>
      )}
      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        {reward.is_featured && (
          <Badge variant="default" className="gap-1">
            <Star className="size-3" /> מודגש
          </Badge>
        )}
        {reward.is_monetary && (
          <Badge variant="outline" className="text-primary">
            שווי ₪{monetaryValue(reward.credit_cost, ilsPerCoin, giftValuePct).toLocaleString("he-IL")}
          </Badge>
        )}
        {reward.kind !== "generic" && (
          <Badge variant="outline">{KIND_LABEL[reward.kind]}</Badge>
        )}
        {limited && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Package className="size-3" /> מלאי {reward.stock}
          </span>
        )}
        {(reward.available_from || reward.available_until) && (
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="size-3" /> מוגבל בזמן
          </span>
        )}
        <span className="flex items-center gap-1 text-muted-foreground">
          <Repeat className="size-3" /> {repeatLabel(reward.cooldown_days)}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-1 border-t border-border pt-2">
        <Button size="sm" variant="ghost" onClick={onEdit}>
          <Pencil className="size-3.5" /> עריכה
        </Button>
        <Button size="sm" variant="ghost" onClick={toggle}>
          {reward.is_active ? "השבת" : "הפעל"}
        </Button>
        <div className="ms-auto flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            aria-label="העבר למעלה"
            disabled={index === 0 || busy}
            onClick={() => move(-1)}
          >
            <ChevronUp className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="העבר למטה"
            disabled={index === siblings.length - 1 || busy}
            onClick={() => move(1)}
          >
            <ChevronDown className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive"
            aria-label="מחיקה"
            onClick={remove}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function RewardSheet({
  reward,
  open,
  ilsPerCoin,
  giftValuePct,
  siblingsForNew,
  onClose,
}: {
  reward: Reward | null;
  open: boolean;
  ilsPerCoin: number;
  giftValuePct: number;
  siblingsForNew?: Reward[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const isEdit = !!reward;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => ({
    name: reward?.name ?? "",
    description: reward?.description ?? "",
    icon: reward?.icon ?? "",
    audience: (reward?.audience ?? "client") as Audience,
    kind: (reward?.kind ?? "generic") as Kind,
    credit_cost: String(reward?.credit_cost ?? 100),
    repeat: (reward
      ? reward.cooldown_days == null
        ? "one_time"
        : reward.cooldown_days === 0
          ? "repeatable"
          : "cooldown"
      : "one_time") as RepeatPolicy,
    cooldown_days: String(reward?.cooldown_days && reward.cooldown_days > 0 ? reward.cooldown_days : 30),
    stock: reward?.stock != null ? String(reward.stock) : "",
    available_from: (reward?.available_from ?? null) as string | null,
    available_until: (reward?.available_until ?? null) as string | null,
    is_featured: reward?.is_featured ?? false,
    is_monetary: reward?.is_monetary ?? false,
    is_active: reward?.is_active ?? true,
  }));
  const [gift, setGift] = useState("");

  const giftNum = Number(gift);
  const giftCoins = ilsToCoins(giftNum, ilsPerCoin);
  const costNum = Number(form.credit_cost);
  const derivedValue = costNum > 0 ? monetaryValue(costNum, ilsPerCoin, giftValuePct) : 0;

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save() {
    const name = clampText(form.name.trim(), 120);
    const cost = Number(form.credit_cost);
    if (!name) return toastError("תן שם לפרס.");
    if (!Number.isInteger(cost) || cost <= 0) return toastError("עלות לא תקינה.");

    let cooldown_days: number | null = null;
    if (form.repeat === "repeatable") cooldown_days = 0;
    else if (form.repeat === "cooldown") {
      const d = Number(form.cooldown_days);
      if (!Number.isInteger(d) || d <= 0) return toastError("מספר ימי המתנה לא תקין.");
      cooldown_days = d;
    }

    let stock: number | null = null;
    if (form.stock.trim() !== "") {
      const s = Number(form.stock);
      if (!Number.isInteger(s) || s < 0) return toastError("מלאי לא תקין.");
      stock = s;
    }

    const from = form.available_from;
    const until = form.available_until;
    if (from && until && new Date(until) <= new Date(from))
      return toastError("תאריך הסיום חייב להיות אחרי תאריך ההתחלה.");

    const payload = {
      name,
      description: clampText(form.description.trim(), 300) || null,
      icon: form.icon || null,
      credit_cost: cost,
      audience: form.audience,
      kind: form.kind,
      cooldown_days,
      stock,
      available_from: from,
      available_until: until,
      is_featured: form.is_featured,
      is_monetary: form.is_monetary,
      is_active: form.is_active,
    };

    setSaving(true);
    let error;
    if (isEdit) {
      ({ error } = await supabase.from("rewards").update(payload).eq("id", reward!.id));
    } else {
      // New rewards go to the end of their audience group.
      const maxOrder = (siblingsForNew ?? [])
        .filter((r) => r.audience === form.audience)
        .reduce((m, r) => Math.max(m, r.sort_order), -1);
      ({ error } = await supabase
        .from("rewards")
        .insert({ ...payload, reward_type: "custom", sort_order: maxOrder + 1 }));
    }
    setSaving(false);
    if (error) return toastError(isEdit ? "עדכון הפרס נכשל." : "הוספת הפרס נכשלה.");
    toast({ title: isEdit ? "הפרס עודכן" : "הפרס נוסף", variant: "success" });
    qc.invalidateQueries({ queryKey: ["admin-referrals"] });
    onClose();
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isEdit ? "עריכת פרס" : "הוספת פרס"}</SheetTitle>
          <SheetDescription>פרס שניתן לממש בחנות בתמורה למטבעות.</SheetDescription>
        </SheetHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="rw-name">שם הפרס</Label>
            <Input
              id="rw-name"
              value={form.name}
              maxLength={120}
              onChange={(e) => set("name", e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label>אייקון</Label>
            <div className="flex flex-wrap gap-1.5">
              {REWARD_ICON_KEYS.map((key) => {
                const Ico = REWARD_ICONS[key];
                const sel = form.icon === key;
                return (
                  <button
                    key={key}
                    type="button"
                    aria-label={key}
                    onClick={() => set("icon", sel ? "" : key)}
                    className={
                      "grid size-9 place-items-center rounded-lg border transition " +
                      (sel
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground")
                    }
                  >
                    <Ico className="size-4" />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rw-desc">תיאור</Label>
            <Textarea
              id="rw-desc"
              value={form.description}
              maxLength={300}
              onChange={(e) => set("description", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="rw-aud">קהל יעד</Label>
              <SelectMenu
                id="rw-aud"
                variant="field"
                ariaLabel="קהל יעד"
                value={form.audience}
                onChange={(v) => set("audience", v)}
                options={(["client", "partner", "both"] as Audience[]).map((a) => ({
                  value: a,
                  label: AUDIENCE_LABEL[a],
                }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rw-kind">סוג</Label>
              <SelectMenu
                id="rw-kind"
                variant="field"
                ariaLabel="סוג"
                value={form.kind}
                onChange={(v) => set("kind", v)}
                options={(["generic", "payout", "commission_boost"] as Kind[]).map((k) => ({
                  value: k,
                  label: KIND_LABEL[k],
                }))}
              />
            </div>
          </div>

          <div className="space-y-1.5 rounded-xl border border-border bg-muted p-3">
            <Label htmlFor="rw-cost">עלות במטבעות</Label>
            <Input
              id="rw-cost"
              dir="ltr"
              type="number"
              min="1"
              value={form.credit_cost}
              onChange={(e) => set("credit_cost", e.target.value)}
            />
            <div className="flex items-end gap-2 pt-1">
              <div className="flex-1 space-y-1">
                <Label htmlFor="rw-gift" className="text-xs text-muted-foreground">
                  מחשבון: שווי מתנה (₪)
                </Label>
                <Input
                  id="rw-gift"
                  dir="ltr"
                  type="number"
                  min="0"
                  placeholder="לדוגמה 100"
                  value={gift}
                  onChange={(e) => setGift(e.target.value)}
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                disabled={!(giftCoins > 0)}
                onClick={() => set("credit_cost", String(giftCoins))}
              >
                <Coins className="size-4" />
                {giftCoins > 0 ? `החל ${giftCoins}` : "החל"}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rw-repeat">מדיניות חזרה</Label>
            <SelectMenu
              id="rw-repeat"
              variant="field"
              ariaLabel="מדיניות חזרה"
              value={form.repeat}
              onChange={(v) => set("repeat", v)}
              options={[
                { value: "one_time", label: "חד-פעמי" },
                { value: "repeatable", label: "ניתן לחזרה (ללא המתנה)" },
                { value: "cooldown", label: "המתנה בין מימושים" },
              ]}
            />
            {form.repeat === "cooldown" && (
              <div className="flex items-center gap-2 pt-1">
                <Input
                  dir="ltr"
                  type="number"
                  min="1"
                  className="w-24"
                  value={form.cooldown_days}
                  onChange={(e) => set("cooldown_days", e.target.value)}
                />
                <span className="text-sm text-muted-foreground">ימי המתנה</span>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rw-stock">מלאי (כמות מוגבלת)</Label>
            <Input
              id="rw-stock"
              dir="ltr"
              type="number"
              min="0"
              placeholder="ריק = ללא הגבלה"
              value={form.stock}
              onChange={(e) => set("stock", e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              סך המימושים המותרים לכלל המשתמשים. ריק = ללא הגבלה.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>זמין מ-</Label>
              <DateTimePicker
                value={form.available_from}
                onChange={(v) => set("available_from", v)}
                placeholder="תמיד"
              />
            </div>
            <div className="space-y-1.5">
              <Label>זמין עד</Label>
              <DateTimePicker
                value={form.available_until}
                onChange={(v) => set("available_until", v)}
                placeholder="ללא הגבלה"
              />
            </div>
          </div>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.is_monetary}
              onChange={(e) => set("is_monetary", e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            פרס בעל ערך כספי
            {form.is_monetary && derivedValue > 0 && (
              <span className="text-primary">
                · שווי ₪{derivedValue.toLocaleString("he-IL")} ({giftValuePct}%)
              </span>
            )}
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.is_featured}
              onChange={(e) => set("is_featured", e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            <Star className="size-4 text-primary" /> פרס מודגש (קופץ בראש החנות)
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={(e) => set("is_active", e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            פרס פעיל (מוצג בחנות)
          </label>
        </div>

        <SheetFooter>
          <Button onClick={save} disabled={saving}>
            {saving ? "שומר…" : isEdit ? "שמירה" : "הוספה"}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            ביטול
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
