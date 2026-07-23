// Quote builder , free-form editor for the items ALREADY in the quote's
// scope. The catalog pickers (ScopeSection) only toggle items in and out;
// this card is where the admin edits what the client will actually read:
// per-quote label + description overrides (never touching the shared
// catalog), value, mode, removal, and fully custom items that don't come
// from the catalog at all (e.g. a GoHighLevel-specific deliverable). Custom
// items must carry one of the type's kinds, or the public IncludedSection
// won't render them , hence the per-kind add buttons.
//
// Items are grouped by kind (הבסיס / עמודים / פיצ'רים / ...), exactly the way
// the client's IncludedSection groups them, and each group can be drag-reordered
// , the array order within a kind IS the order the client reads. "סדר עם AI"
// orders them all into a logical landing-page flow in one click.

import { type CSSProperties } from "react";
import { Plus, X, GripVertical, Sparkles, Loader2 } from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { ScopeItem, ScopeItemKind } from "@/lib/quote-pricing";
import { MODE_OPTIONS, type ScopeItemMode } from "./ScopeSection";

function modeOf(item: ScopeItem): ScopeItemMode {
  if (item.free) return "free";
  if (item.optional) return "optional";
  return "included";
}

type RowHandlers = {
  disabled?: boolean;
  onPatch: (itemId: string, patch: Partial<ScopeItem>) => void;
  onSetMode: (itemId: string, mode: ScopeItemMode) => void;
  onRemove: (itemId: string) => void;
};

/** Presentational row: label + value + desc + mode toggles + remove. `drag`
 *  carries the sortable wiring (absent for the non-draggable base line). */
function ScopeRow({
  item,
  disabled,
  onPatch,
  onSetMode,
  onRemove,
  drag,
}: RowHandlers & {
  item: ScopeItem;
  drag?: {
    setNodeRef: (el: HTMLElement | null) => void;
    style: CSSProperties;
    handle: Record<string, unknown>;
    dragging: boolean;
  };
}) {
  const isBase = item.kind === "subtype";
  return (
    <div
      ref={drag?.setNodeRef}
      style={drag?.style}
      className={cn(
        "space-y-2 rounded-xl border border-border bg-field p-3",
        drag?.dragging && "z-10 opacity-80 shadow-lg",
      )}
    >
      <div className="flex items-center gap-2">
        {drag && (
          <button
            type="button"
            {...drag.handle}
            disabled={disabled}
            aria-label={`גרור לשינוי הסדר של ${item.label || "הפריט"}`}
            className={cn(
              "grid size-9 shrink-0 cursor-grab touch-none place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:text-foreground active:cursor-grabbing",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <GripVertical className="size-4" />
          </button>
        )}
        <Input
          value={item.label}
          onChange={(e) => onPatch(item.id, { label: e.target.value })}
          placeholder="שם הפריט (מוצג ללקוח)"
          disabled={disabled}
          className="h-9 flex-1 font-medium"
          aria-label="שם הפריט"
        />
        <Input
          type="number"
          value={item.value}
          onChange={(e) => onPatch(item.id, { value: Number(e.target.value) || 0 })}
          disabled={disabled}
          className="h-9 w-24 shrink-0 text-end text-sm"
          aria-label={`ערך עבור ${item.label || "פריט"}`}
        />
        {!isBase && (
          <button
            type="button"
            disabled={disabled}
            onClick={() => onRemove(item.id)}
            aria-label={`הסר את ${item.label || "הפריט"}`}
            className={cn(
              "grid size-9 shrink-0 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      <Input
        value={item.desc ?? ""}
        onChange={(e) => onPatch(item.id, { desc: e.target.value || undefined })}
        placeholder="הסבר קצר ללקוח (אופציונלי)"
        disabled={disabled}
        className="h-9 text-sm"
        aria-label={`הסבר עבור ${item.label || "פריט"}`}
      />
      {!isBase && (
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-background/40 p-0.5 text-xs">
          {MODE_OPTIONS.map((opt) => {
            const active = modeOf(item) === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                onClick={() => !active && onSetMode(item.id, opt.value)}
                aria-pressed={active}
                className={cn(
                  "rounded-md px-2 py-1 font-medium transition-colors",
                  active
                    ? "border border-primary bg-primary/15 text-primary"
                    : "border border-transparent text-muted-foreground",
                  disabled && "cursor-not-allowed opacity-60",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Sortable wrapper , owns the dnd transform, drags only from the grip handle. */
function SortableScopeRow(props: RowHandlers & { item: ScopeItem }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.item.id,
    disabled: props.disabled,
  });
  return (
    <ScopeRow
      {...props}
      drag={{
        setNodeRef,
        style: { transform: CSS.Transform.toString(transform), transition },
        handle: { ...attributes, ...listeners },
        dragging: isDragging,
      }}
    />
  );
}

/** One kind group (עמודים / פיצ'רים / ...) with a header + drag-reorderable
 *  rows. Reordering calls onReorder with that kind's new id order. */
function KindGroup({
  title,
  items,
  onReorder,
  ...handlers
}: RowHandlers & {
  title: string;
  items: ScopeItem[];
  onReorder: (orderedIds: string[]) => void;
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  // Render straight from the `items` prop , NO local mirror. The rows hold
  // controlled inputs (label/value/desc), so a mirror synced through useEffect
  // would feed them a one-render-stale value and bounce the caret to the end on
  // every mid-string keystroke. onReorder → applyScopeOrder → setContent updates
  // the parent synchronously on drop, so there's no release-jump to defend
  // against and the prop is always the live order.
  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldI = items.findIndex((it) => it.id === active.id);
    const newI = items.findIndex((it) => it.id === over.id);
    if (oldI < 0 || newI < 0) return;
    onReorder(arrayMove(items, oldI, newI).map((it) => it.id));
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 px-0.5">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <span className="text-xs text-muted-foreground">{items.length}</span>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={items.map((it) => it.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {items.map((it) => (
              <SortableScopeRow key={it.id} item={it} {...handlers} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}

export function ScopeItemsEditor({
  items,
  sections,
  disabled,
  onPatch,
  onSetMode,
  onRemove,
  onAddCustom,
  onReorderKind,
  onAiOrder,
  aiOrderPending,
}: {
  items: ScopeItem[];
  /** The quote type's scope kinds + Hebrew titles (KIND_SECTIONS entry). */
  sections: { kind: ScopeItemKind; title: string }[];
  disabled?: boolean;
  onPatch: (itemId: string, patch: Partial<ScopeItem>) => void;
  onSetMode: (itemId: string, mode: ScopeItemMode) => void;
  onRemove: (itemId: string) => void;
  onAddCustom: (kind: ScopeItemKind) => void;
  /** New order of a single kind's item ids after a drag. */
  onReorderKind: (orderedIds: string[]) => void;
  onAiOrder: () => void;
  aiOrderPending?: boolean;
}) {
  const rowHandlers: RowHandlers = { disabled, onPatch, onSetMode, onRemove };
  const baseItems = items.filter((it) => it.kind === "subtype");
  const orderableCount = items.filter((it) => it.kind !== "subtype").length;

  return (
    <Card className="space-y-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-foreground">פריטי ההצעה, עריכה וסידור</p>
          <p className="text-xs text-muted-foreground">
            מה שכתוב כאן הוא בדיוק מה שהלקוח רואה. הסדר בכל קבוצה הוא הסדר שבו זה יופיע בדף הנחיתה , גרור כדי לסדר.
          </p>
        </div>
        <button
          type="button"
          disabled={disabled || aiOrderPending || orderableCount < 2}
          onClick={onAiOrder}
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-primary/40 px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10",
            (disabled || aiOrderPending || orderableCount < 2) && "cursor-not-allowed opacity-60",
          )}
        >
          {aiOrderPending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          {aiOrderPending ? "מסדר…" : "סדר עם AI"}
        </button>
      </div>

      {items.length === 0 && (
        <p className="rounded-xl border border-dashed border-border p-3 text-center text-sm text-muted-foreground">
          עדיין אין פריטים בהצעה. בחר מהקטלוג למטה או הוסף פריט מותאם.
        </p>
      )}

      {/* the base line (subtype) , editable, but not draggable and not part of a
          reorderable group */}
      {baseItems.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-0.5">
            <h4 className="text-sm font-semibold text-foreground">הבסיס</h4>
          </div>
          {baseItems.map((it) => (
            <ScopeRow key={it.id} item={it} {...rowHandlers} />
          ))}
        </div>
      )}

      {/* one drag-reorderable group per scope kind (עמודים, פיצ'רים, ...) */}
      {sections.map((s) => {
        const group = items.filter((it) => it.kind === s.kind);
        if (group.length === 0) return null;
        return (
          <KindGroup
            key={s.kind}
            title={s.title}
            items={group}
            onReorder={onReorderKind}
            {...rowHandlers}
          />
        );
      })}

      <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
        {sections.map((s) => (
          <button
            key={s.kind}
            type="button"
            disabled={disabled}
            onClick={() => onAddCustom(s.kind)}
            className={cn(
              "inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-primary/40 px-3 text-sm font-medium text-primary transition-colors hover:bg-primary/10",
              disabled && "cursor-not-allowed opacity-60",
            )}
          >
            <Plus className="size-4" />
            {sections.length > 1 ? `פריט מותאם (${s.title})` : "פריט מותאם אישית"}
          </button>
        ))}
      </div>
    </Card>
  );
}
