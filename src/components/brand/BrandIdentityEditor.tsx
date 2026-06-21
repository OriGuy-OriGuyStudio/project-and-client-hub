import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Palette, Pencil, Plus, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectMenu } from "@/components/ui/select-menu";
import { toast, toastError } from "@/hooks/use-toast";
import { uploadBrandAsset, validateBrandAsset } from "@/lib/files";
import {
  useSaveClientBrand,
  type BrandFormValues,
  type ColorDraft,
} from "@/hooks/useClientBrand";
import {
  SOCIAL_PLATFORMS,
  iconForPlatform,
  normalizeSocialLinks,
} from "@/components/brand/social";
import type { BrandColor, BrandColorRole, ClientBrand, LogoFit } from "@/types/database";
import { cn } from "@/lib/utils";

const roleHe: Record<BrandColorRole, string> = {
  primary: "ראשי",
  secondary: "משני",
  accent: "הדגשה",
  background: "רקע",
  text: "טקסט",
  other: "אחר",
};
const ROLE_OPTIONS = (Object.keys(roleHe) as BrandColorRole[]).map((r) => ({
  value: r,
  label: roleHe[r],
}));

const SOCIAL_OPTIONS = SOCIAL_PLATFORMS.map((p) => ({ value: p.key, label: p.label }));

type ColorRow = ColorDraft & { id: string };
type SocialRow = { id: string; platform: string; url: string };

const HEX6 = /^#[0-9a-fA-F]{6}$/;

function seedForm(brand: ClientBrand | null): BrandFormValues {
  return {
    business_name: brand?.business_name ?? "",
    business_description: brand?.business_description ?? "",
    logo_url: brand?.logo_url ?? "",
    logo_icon_url: brand?.logo_icon_url ?? "",
    font_notes: brand?.font_notes ?? "",
    website_url: brand?.website_url ?? "",
    social_links: [], // socials are edited via their own row state below
    logo_fit: brand?.logo_fit ?? "auto",
  };
}

const LOGO_FIT_OPTIONS = [
  { value: "auto", label: "אוטומטי" },
  { value: "contain", label: "מותאם (לוגו שלם)" },
  { value: "cover", label: "מילוי (ממלא מסגרת)" },
];

function seedColors(colors: BrandColor[]): ColorRow[] {
  return colors.map((c) => ({
    id: crypto.randomUUID(),
    hex_value: c.hex_value,
    label: c.label ?? "",
    role: c.role ?? "other",
  }));
}

function seedSocials(brand: ClientBrand | null): SocialRow[] {
  return normalizeSocialLinks(brand?.social_links).map((s) => ({
    id: crypto.randomUUID(),
    platform: s.platform,
    url: s.url,
  }));
}

/**
 * Admin editor for a client's brand identity — logo(s), palette, business
 * details, fonts, site & socials. Side Sheet, RTL. Logos upload to the public
 * brand-assets bucket (with a URL-paste fallback). Saves via useSaveClientBrand.
 */
export function BrandIdentityEditor({
  clientId,
  brand,
  colors,
}: {
  clientId: string;
  brand: ClientBrand | null;
  colors: BrandColor[];
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<BrandFormValues>(() => seedForm(brand));
  const [rows, setRows] = useState<ColorRow[]>(() => seedColors(colors));
  const [socials, setSocials] = useState<SocialRow[]>(() => seedSocials(brand));
  const save = useSaveClientBrand(clientId);

  // Re-seed each time the sheet opens so it reflects the latest saved data.
  useEffect(() => {
    if (open) {
      setForm(seedForm(brand));
      setRows(seedColors(colors));
      setSocials(seedSocials(brand));
    }
  }, [open, brand, colors]);

  const set = <K extends keyof BrandFormValues>(key: K, value: BrandFormValues[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const addSocial = () =>
    setSocials((s) => [
      ...s,
      { id: crypto.randomUUID(), platform: "instagram", url: "" },
    ]);
  const removeSocial = (id: string) =>
    setSocials((s) => s.filter((x) => x.id !== id));
  const setSocial = (id: string, patch: Partial<Omit<SocialRow, "id">>) =>
    setSocials((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const addColor = () =>
    setRows((r) => [
      ...r,
      { id: crypto.randomUUID(), hex_value: "#000000", label: "", role: "other" },
    ]);
  const removeColor = (id: string) => setRows((r) => r.filter((x) => x.id !== id));
  const setColor = (id: string, patch: Partial<ColorDraft>) =>
    setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  async function handleSave() {
    try {
      const brandValues: BrandFormValues = {
        ...form,
        social_links: socials.map(({ platform, url }) => ({ platform, url })),
      };
      await save.mutateAsync({ brand: brandValues, colors: rows });
      toast({ title: "זהות המותג נשמרה" });
      setOpen(false);
    } catch {
      toastError("השמירה נכשלה. נסה שוב.");
    }
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="secondary" size="sm">
          <Pencil className="size-4" />
          עריכת זהות מותג
        </Button>
      </SheetTrigger>

      <SheetContent className="max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Palette className="size-5 text-brand-cyan-base" />
            זהות המותג של הלקוח
          </SheetTitle>
          <SheetDescription>
            הלוגו, הצבעים והפרטים שיוצגו ללקוח בעמוד הפרויקט.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5">
          {/* Logos */}
          <div className="grid grid-cols-2 gap-3">
            <LogoField
              label="לוגו ראשי"
              clientId={clientId}
              value={form.logo_url}
              onChange={(v) => set("logo_url", v)}
            />
            <LogoField
              label="אייקון (מצומצם)"
              clientId={clientId}
              value={form.logo_icon_url}
              onChange={(v) => set("logo_icon_url", v)}
            />
          </div>

          {/* How the logo sits inside round/framed avatars across the app. */}
          <div className="space-y-1.5">
            <Label htmlFor="b-logo-fit">התאמת הלוגו</Label>
            <SelectMenu
              id="b-logo-fit"
              variant="field"
              ariaLabel="התאמת הלוגו"
              value={form.logo_fit}
              onChange={(v) => set("logo_fit", v as LogoFit)}
              options={LOGO_FIT_OPTIONS}
            />
            <p className="text-xs text-muted-foreground">
              אוטומטי בוחר לבד; בחר ידנית אם לוגו מסוים נחתך או מוצג קטן מדי.
            </p>
          </div>

          {/* Business details */}
          <div className="space-y-1.5">
            <Label htmlFor="b-name">שם העסק</Label>
            <Input
              id="b-name"
              value={form.business_name}
              maxLength={160}
              onChange={(e) => set("business_name", e.target.value)}
              placeholder="לדוגמה: מאפיית לחם הארץ"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="b-desc">תיאור העסק</Label>
            <Textarea
              id="b-desc"
              value={form.business_description}
              maxLength={2000}
              onChange={(e) => set("business_description", e.target.value)}
              placeholder="כמה מילים על העסק והקהל שלו"
            />
          </div>

          {/* Colors */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>צבעי המותג</Label>
              <Button variant="ghost" size="sm" onClick={addColor}>
                <Plus className="size-4" />
                הוספת צבע
              </Button>
            </div>
            {rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">עדיין לא הוגדרו צבעים.</p>
            ) : (
              <div className="space-y-2">
                {rows.map((row) => (
                  <div key={row.id} className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label="בורר צבע"
                      value={HEX6.test(row.hex_value) ? row.hex_value : "#000000"}
                      onChange={(e) => setColor(row.id, { hex_value: e.target.value })}
                      className="color-dot size-9 shrink-0 rounded-full"
                    />
                    <Input
                      dir="ltr"
                      value={row.hex_value}
                      maxLength={9}
                      onChange={(e) => setColor(row.id, { hex_value: e.target.value })}
                      placeholder="#1A1A1A"
                      className="h-9 w-28 font-mono-code text-xs"
                    />
                    <Input
                      value={row.label}
                      maxLength={40}
                      onChange={(e) => setColor(row.id, { label: e.target.value })}
                      placeholder="שם הצבע"
                      className="h-9 flex-1"
                    />
                    <SelectMenu
                      ariaLabel="תפקיד הצבע"
                      className="h-9 w-24 shrink-0"
                      value={row.role ?? "other"}
                      onChange={(v) => setColor(row.id, { role: v })}
                      options={ROLE_OPTIONS}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 shrink-0 text-destructive"
                      aria-label="הסרת צבע"
                      onClick={() => removeColor(row.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fonts + site */}
          <div className="space-y-1.5">
            <Label htmlFor="b-fonts">פונטים / הערות טיפוגרפיה</Label>
            <Input
              id="b-fonts"
              value={form.font_notes}
              maxLength={300}
              onChange={(e) => set("font_notes", e.target.value)}
              placeholder="לדוגמה: כותרות Heebo, גוף טקסט Assistant"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="b-site">אתר</Label>
            <Input
              id="b-site"
              dir="ltr"
              value={form.website_url}
              maxLength={300}
              onChange={(e) => set("website_url", e.target.value)}
              placeholder="https://example.com"
            />
          </div>

          {/* Socials — dynamic list; same platform may repeat */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>רשתות חברתיות</Label>
              <Button variant="ghost" size="sm" onClick={addSocial}>
                <Plus className="size-4" />
                הוספת רשת
              </Button>
            </div>
            {socials.length === 0 ? (
              <p className="text-sm text-muted-foreground">לא נוספו רשתות.</p>
            ) : (
              <div className="space-y-2">
                {socials.map((row) => {
                  const Icon = iconForPlatform(row.platform);
                  return (
                    <div key={row.id} className="flex items-center gap-2">
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-input bg-field text-muted-foreground">
                        <Icon className="size-4" />
                      </span>
                      <SelectMenu
                        ariaLabel="רשת"
                        className="h-9 w-28 shrink-0"
                        value={row.platform}
                        onChange={(v) => setSocial(row.id, { platform: v })}
                        options={SOCIAL_OPTIONS}
                      />
                      <Input
                        dir="ltr"
                        value={row.url}
                        maxLength={300}
                        onChange={(e) => setSocial(row.id, { url: e.target.value })}
                        placeholder="https://…"
                        className="h-9 flex-1"
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-9 shrink-0 text-destructive"
                        aria-label="הסרת רשת"
                        onClick={() => removeSocial(row.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <SheetFooter>
          <Button onClick={handleSave} disabled={save.isPending}>
            {save.isPending ? "שומר…" : "שמירה"}
          </Button>
          <SheetClose asChild>
            <Button variant="ghost">ביטול</Button>
          </SheetClose>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/** Single logo slot: live preview + file upload (public bucket) + URL paste. */
function LogoField({
  label,
  clientId,
  value,
  onChange,
}: {
  label: string;
  clientId: string;
  value: string;
  onChange: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-picking the same file
    if (!file) return;
    const err = validateBrandAsset(file);
    if (err) return toastError(err);
    setBusy(true);
    try {
      const url = await uploadBrandAsset({ clientId, file });
      onChange(url);
    } catch {
      toastError("העלאת הלוגו נכשלה.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-dashed border-input bg-field text-muted-foreground transition-colors hover:border-primary/50",
            busy && "pointer-events-none opacity-60"
          )}
          aria-label={`העלאת ${label}`}
        >
          {busy ? (
            <Loader2 className="size-5 animate-spin" />
          ) : value ? (
            <img src={value} alt="" className="size-full object-contain" />
          ) : (
            <ImagePlus className="size-5" />
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="hidden"
          onChange={onFile}
        />
      </div>
      <Input
        dir="ltr"
        value={value}
        maxLength={500}
        onChange={(e) => onChange(e.target.value)}
        placeholder="או הדבק כתובת URL"
        className="h-8 text-xs"
      />
    </div>
  );
}
