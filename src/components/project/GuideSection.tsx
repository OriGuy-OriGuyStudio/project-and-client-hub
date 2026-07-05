import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  BookOpen,
  Bold,
  Italic,
  Heading2,
  List,
  ListOrdered,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Copy,
  ExternalLink,
  KeyRound,
  LogIn,
  FileText,
  Layers,
  Image as ImageIcon,
  Menu as MenuIcon,
  Search,
  Settings,
  ShoppingCart,
  Rocket,
  HelpCircle,
  PlayCircle,
  LibraryBig,
  Pencil,
  ImagePlus,
  X,
  ChevronLeft,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { SelectMenu } from "@/components/ui/select-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { supabase } from "@/lib/supabase";
import { uploadGuideImage, validateGuideImage } from "@/lib/files";
import { toast, toastError } from "@/hooks/use-toast";
import { sanitizeHtml, clampText } from "@/lib/sanitize";
import { cn } from "@/lib/utils";
import type { GuideArticle, GuideTemplate, ProjectSiteCredential } from "@/types/database";

/* ---------------- icons ---------------- */

const GUIDE_ICONS: Record<string, LucideIcon> = {
  login: LogIn,
  post: FileText,
  cpt: Layers,
  media: ImageIcon,
  menu: MenuIcon,
  seo: Search,
  settings: Settings,
  shop: ShoppingCart,
  key: KeyRound,
  launch: Rocket,
  video: PlayCircle,
  help: HelpCircle,
};
const ICON_OPTIONS: { value: string; label: string }[] = [
  { value: "post", label: "פוסט / תוכן" },
  { value: "cpt", label: "סוג תוכן (CPT)" },
  { value: "login", label: "כניסה" },
  { value: "media", label: "מדיה / תמונות" },
  { value: "menu", label: "תפריט" },
  { value: "seo", label: "קידום / SEO" },
  { value: "shop", label: "חנות" },
  { value: "settings", label: "הגדרות" },
  { value: "video", label: "וידאו" },
  { value: "help", label: "כללי" },
];
function iconFor(name: string | null): LucideIcon {
  return (name && GUIDE_ICONS[name]) || HelpCircle;
}

/* ---------------- safe media embed ---------------- */

function MediaEmbed({ url }: { url: string }) {
  const clean = url.trim();
  if (!/^https:\/\//i.test(clean)) return null;

  const yt = clean.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{6,})/i);
  const loom = clean.match(/loom\.com\/(?:share|embed)\/([\w-]+)/i);
  const vimeo = clean.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  // Google Drive share links -> /preview (plays inline, no download/redirect).
  const gdriveId = /drive\.google\.com/i.test(clean)
    ? (clean.match(/\/file\/d\/([\w-]+)/i) || clean.match(/[?&]id=([\w-]+)/i))?.[1] ?? null
    : null;
  const embed =
    (yt && `https://www.youtube.com/embed/${yt[1]}`) ||
    (loom && `https://www.loom.com/embed/${loom[1]}`) ||
    (vimeo && `https://player.vimeo.com/video/${vimeo[1]}`) ||
    (gdriveId && `https://drive.google.com/file/d/${gdriveId}/preview`) ||
    null;

  if (embed) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-black">
        <iframe
          src={embed}
          title="מדיה"
          allow="fullscreen; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 size-full"
        />
      </div>
    );
  }
  if (/\.(mp4|webm|mov)$/i.test(clean)) {
    return <video src={clean} controls className="w-full rounded-xl border border-border" />;
  }
  if (/\.(png|jpe?g|gif|webp|avif|svg)$/i.test(clean)) {
    return <img src={clean} alt="" className="w-full rounded-xl border border-border" />;
  }
  return null;
}

/* ---------------- image lightbox (in-app, never leaves) ---------------- */

function Lightbox({
  images,
  index,
  onClose,
  onNav,
}: {
  images: string[];
  index: number;
  onClose: () => void;
  onNav: (i: number) => void;
}) {
  const many = images.length > 1;
  const go = (delta: number) => onNav((index + delta + images.length) % images.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      // RTL: right arrow -> previous, left arrow -> next
      if (e.key === "ArrowRight") go(-1);
      if (e.key === "ArrowLeft") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, images.length]);

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        onClick={onClose}
        aria-label="סגירה"
        className="absolute end-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
      >
        <X className="size-5" />
      </button>

      {many && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); go(-1); }}
            aria-label="הקודם"
            className="absolute end-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
          >
            <ChevronRight className="size-6" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); go(1); }}
            aria-label="הבא"
            className="absolute start-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
          >
            <ChevronLeft className="size-6" />
          </button>
        </>
      )}

      <img
        src={images[index]}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] max-w-[92vw] rounded-lg object-contain shadow-2xl"
      />
    </div>,
    document.body,
  );
}

/* ---------------- rich-text toolbar ---------------- */

function Toolbar({ editor }: { editor: Editor }) {
  const tools = [
    { icon: Bold, action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive("bold") },
    { icon: Italic, action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive("italic") },
    { icon: Heading2, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive("heading", { level: 2 }) },
    { icon: List, action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive("bulletList") },
    { icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive("orderedList") },
  ];
  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-background/30 p-1">
      {tools.map((t, i) => (
        <Button
          key={i}
          type="button"
          variant="ghost"
          size="icon"
          className={cn("size-8", t.active && "bg-primary/15 text-primary")}
          onClick={t.action}
        >
          <t.icon className="size-4" />
        </Button>
      ))}
    </div>
  );
}

/* ---------------- editor sheet (article OR template) ---------------- */

type GuideDraft = {
  title: string;
  icon: string;
  category: string;
  media_url: string;
  images: string[];
  body_html: string;
  is_published: boolean;
};

const emptyDraft = (): GuideDraft => ({
  title: "",
  icon: "post",
  category: "",
  media_url: "",
  images: [],
  body_html: "<p></p>",
  is_published: true,
});

function GuideEditorSheet({
  open,
  onOpenChange,
  initial,
  heading,
  showPublish,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: GuideDraft;
  heading: string;
  showPublish: boolean;
  onSave: (draft: GuideDraft) => void | Promise<unknown>;
}) {
  const [draft, setDraft] = useState<GuideDraft>(initial);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const editor = useEditor(
    { extensions: [StarterKit], content: initial.body_html || "<p></p>" },
    [initial],
  );

  function set<K extends keyof GuideDraft>(k: K, v: GuideDraft[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  async function addImages(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    const urls: string[] = [];
    for (const f of Array.from(files)) {
      const err = validateGuideImage(f);
      if (err) {
        toastError(err);
        continue;
      }
      try {
        urls.push(await uploadGuideImage(f));
      } catch {
        toastError("העלאת התמונה נכשלה.");
      }
    }
    if (urls.length) setDraft((d) => ({ ...d, images: [...d.images, ...urls] }));
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function removeImage(i: number) {
    setDraft((d) => ({ ...d, images: d.images.filter((_, idx) => idx !== i) }));
  }

  async function submit() {
    const title = clampText(draft.title.trim(), 160);
    if (!title) return toastError("תן כותרת למדריך.");
    setSaving(true);
    await onSave({
      ...draft,
      title,
      category: clampText(draft.category.trim(), 60),
      media_url: draft.media_url.trim(),
      body_html: sanitizeHtml(editor?.getHTML() ?? draft.body_html),
    });
    setSaving(false);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-4 sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{heading}</SheetTitle>
          <SheetDescription>כותרת, אייקון, מדיה אופציונלית והסבר שלב-אחר-שלב.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-4 overflow-y-auto pe-1">
          <div className="space-y-1.5">
            <Label htmlFor="g-title">כותרת</Label>
            <Input
              id="g-title"
              placeholder="איך מפרסמים פוסט חדש"
              maxLength={160}
              value={draft.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>אייקון</Label>
              <SelectMenu
                variant="field"
                value={draft.icon}
                onChange={(v) => set("icon", v)}
                options={ICON_OPTIONS}
                ariaLabel="אייקון"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="g-cat">קטגוריה (רשות)</Label>
              <Input
                id="g-cat"
                placeholder="בסיס, תוכן, מתקדם…"
                maxLength={60}
                value={draft.category}
                onChange={(e) => set("category", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="g-media">וידאו (קישור ל-Loom / YouTube, רשות)</Label>
            <Input
              id="g-media"
              dir="ltr"
              placeholder="https://www.loom.com/share/…"
              value={draft.media_url}
              onChange={(e) => set("media_url", e.target.value)}
            />
            {draft.media_url.trim() && (
              <div className="pt-1">
                <MediaEmbed url={draft.media_url} />
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>תמונות / צילומי מסך (רשות)</Label>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => addImages(e.target.files)}
            />
            <div className="flex flex-wrap gap-2">
              {draft.images.map((url, i) => (
                <div key={url} className="relative size-20 overflow-hidden rounded-lg border border-border">
                  <img src={url} alt="" className="size-full object-cover" />
                  <button
                    type="button"
                    aria-label="הסרה"
                    onClick={() => removeImage(i)}
                    className="absolute end-1 top-1 rounded bg-black/60 p-0.5 text-white transition hover:bg-black/80"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="grid size-20 place-items-center rounded-lg border border-dashed border-border text-muted-foreground transition hover:border-primary/50 hover:text-foreground disabled:opacity-50"
              >
                <ImagePlus className="size-5" />
              </button>
            </div>
            {uploading && <p className="text-xs text-muted-foreground">מעלה תמונות…</p>}
          </div>

          <div className="space-y-1.5">
            <Label>תוכן</Label>
            {editor && <Toolbar editor={editor} />}
            <div dir="rtl" className="rte-content min-h-32 rounded-xl border border-border bg-background/30 p-4">
              {editor ? <EditorContent editor={editor} /> : <Skeleton className="h-24 w-full" />}
            </div>
          </div>

          {showPublish && (
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={draft.is_published}
                onChange={(e) => set("is_published", e.target.checked)}
                className="size-4 accent-primary"
              />
              מוצג ללקוח (בטל כדי לשמור כטיוטה)
            </label>
          )}
        </div>

        <SheetFooter>
          <Button onClick={submit} disabled={saving}>
            {saving ? "שומר…" : "שמירה"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

/* ---------------- credentials ---------------- */

type CredDraft = {
  label: string;
  login_url: string;
  username: string;
  password_reset_url: string;
  note: string;
};

function copy(text: string) {
  navigator.clipboard?.writeText(text).then(
    () => toast({ title: "הועתק", variant: "success" }),
    () => toastError("ההעתקה נכשלה."),
  );
}

function CredentialCard({
  cred,
  isAdmin,
  onEdit,
  onDelete,
}: {
  cred: ProjectSiteCredential;
  isAdmin: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/30 p-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-heading text-sm font-semibold text-foreground">
          <KeyRound className="size-4 text-brand-cyan-base" />
          {cred.label}
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="size-8" aria-label="עריכה" onClick={onEdit}>
              <Pencil className="size-4" />
            </Button>
            <Button variant="ghost" size="icon" className="size-8 text-destructive" aria-label="מחיקה" onClick={onDelete}>
              <Trash2 className="size-4" />
            </Button>
          </div>
        )}
      </div>

      <dl className="space-y-2 text-sm">
        {cred.login_url && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">כתובת ניהול</dt>
            <a
              href={cred.login_url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-primary hover:underline"
              dir="ltr"
            >
              <ExternalLink className="size-3.5" /> כניסה
            </a>
          </div>
        )}
        {cred.username && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">שם משתמש</dt>
            <button
              onClick={() => copy(cred.username!)}
              className="inline-flex items-center gap-1.5 rounded-md bg-field px-2 py-0.5 font-mono text-foreground hover:bg-field/70"
              dir="ltr"
            >
              {cred.username} <Copy className="size-3.5" />
            </button>
          </div>
        )}
        {cred.password_reset_url && (
          <div className="flex items-center justify-between gap-2">
            <dt className="text-muted-foreground">סיסמה</dt>
            <a href={cred.password_reset_url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
              איפוס / הגדרת סיסמה
            </a>
          </div>
        )}
        {cred.note && <p className="pt-1 text-muted-foreground">{cred.note}</p>}
      </dl>

      {isAdmin && (
        <p className="mt-3 border-t border-border/60 pt-2 text-xs text-muted-foreground">
          מטעמי אבטחה לא נשמרת כאן סיסמה, רק כתובת, שם משתמש וקישור לאיפוס.
        </p>
      )}
    </div>
  );
}

/* ================================================================= */

export function GuideSection({
  projectId,
  isAdmin,
  actorId,
}: {
  projectId: string;
  isAdmin: boolean;
  actorId: string | null;
}) {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<number | null>(null);

  // editor sheets
  const [articleSheet, setArticleSheet] = useState<{ open: boolean; editing: GuideArticle | null }>({ open: false, editing: null });
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [templateSheet, setTemplateSheet] = useState<{ open: boolean; editing: GuideTemplate | null }>({ open: false, editing: null });
  const [credSheet, setCredSheet] = useState<{ open: boolean; editing: ProjectSiteCredential | null }>({ open: false, editing: null });

  const { data: articles, isLoading } = useQuery({
    queryKey: ["guide-articles", projectId],
    queryFn: async (): Promise<GuideArticle[]> => {
      const { data, error } = await supabase
        .from("guide_articles")
        .select("*")
        .eq("project_id", projectId)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: creds } = useQuery({
    queryKey: ["guide-creds", projectId],
    queryFn: async (): Promise<ProjectSiteCredential[]> => {
      const { data, error } = await supabase
        .from("project_site_credentials")
        .select("*")
        .eq("project_id", projectId)
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: templates } = useQuery({
    queryKey: ["guide-templates"],
    enabled: isAdmin,
    queryFn: async (): Promise<GuideTemplate[]> => {
      const { data, error } = await supabase
        .from("guide_templates")
        .select("*")
        .order("order_index", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["guide-articles", projectId] });
  const refreshCreds = () => qc.invalidateQueries({ queryKey: ["guide-creds", projectId] });
  const refreshTemplates = () => qc.invalidateQueries({ queryKey: ["guide-templates"] });

  const selected = useMemo(
    () => articles?.find((a) => a.id === selectedId) ?? articles?.[0] ?? null,
    [articles, selectedId],
  );

  /* -------- article mutations -------- */
  async function saveArticle(draft: GuideDraft) {
    if (articleSheet.editing) {
      const { error } = await supabase
        .from("guide_articles")
        .update({
          title: draft.title,
          icon: draft.icon,
          category: draft.category || null,
          media_url: draft.media_url || null,
          images: draft.images,
          body_html: draft.body_html,
          is_published: draft.is_published,
          updated_by: actorId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", articleSheet.editing.id);
      if (error) return toastError("שמירת המדריך נכשלה.");
    } else {
      const nextOrder = (articles?.reduce((m, a) => Math.max(m, a.order_index), -1) ?? -1) + 1;
      const { data, error } = await supabase
        .from("guide_articles")
        .insert({
          project_id: projectId,
          title: draft.title,
          icon: draft.icon,
          category: draft.category || null,
          media_url: draft.media_url || null,
          images: draft.images,
          body_html: draft.body_html,
          is_published: draft.is_published,
          order_index: nextOrder,
          created_by: actorId,
          updated_by: actorId,
        })
        .select("id")
        .single();
      if (error || !data) return toastError("יצירת המדריך נכשלה.");
      setSelectedId(data.id);
    }
    toast({ title: "נשמר", variant: "success" });
    refresh();
  }

  async function removeArticle(a: GuideArticle) {
    const { error } = await supabase.from("guide_articles").delete().eq("id", a.id);
    if (error) return toastError("המחיקה נכשלה.");
    if (selectedId === a.id) setSelectedId(null);
    refresh();
  }

  async function togglePublish(a: GuideArticle) {
    const { error } = await supabase
      .from("guide_articles")
      .update({ is_published: !a.is_published })
      .eq("id", a.id);
    if (error) return toastError("העדכון נכשל.");
    refresh();
  }

  async function move(a: GuideArticle, dir: -1 | 1) {
    const list = articles ?? [];
    const i = list.findIndex((x) => x.id === a.id);
    const j = i + dir;
    if (j < 0 || j >= list.length) return;
    const other = list[j];
    await Promise.all([
      supabase.from("guide_articles").update({ order_index: other.order_index }).eq("id", a.id),
      supabase.from("guide_articles").update({ order_index: a.order_index }).eq("id", other.id),
    ]);
    refresh();
  }

  async function attachTemplate(templateId: string) {
    const { error } = await supabase.rpc("apply_guide_template", {
      p_project_id: projectId,
      p_template_id: templateId,
    });
    if (error) return toastError("הוספת התבנית נכשלה.");
    toast({ title: "התבנית נוספה למדריך", variant: "success" });
    refresh();
  }

  async function saveAsTemplate(a: GuideArticle) {
    const nextOrder = (templates?.reduce((m, t) => Math.max(m, t.order_index), -1) ?? -1) + 1;
    const { error } = await supabase.from("guide_templates").insert({
      title: a.title,
      category: a.category,
      icon: a.icon,
      media_url: a.media_url,
      images: a.images,
      body_html: a.body_html,
      order_index: nextOrder,
    });
    if (error) return toastError("שמירה כתבנית נכשלה.");
    toast({ title: "נשמר כתבנית לסטודיו", variant: "success" });
    refreshTemplates();
  }

  /* -------- template mutations -------- */
  async function saveTemplate(draft: GuideDraft) {
    if (templateSheet.editing) {
      const { error } = await supabase
        .from("guide_templates")
        .update({
          title: draft.title,
          icon: draft.icon,
          category: draft.category || null,
          media_url: draft.media_url || null,
          images: draft.images,
          body_html: draft.body_html,
          updated_at: new Date().toISOString(),
        })
        .eq("id", templateSheet.editing.id);
      if (error) return toastError("שמירת התבנית נכשלה.");
    } else {
      const nextOrder = (templates?.reduce((m, t) => Math.max(m, t.order_index), -1) ?? -1) + 1;
      const { error } = await supabase.from("guide_templates").insert({
        title: draft.title,
        icon: draft.icon,
        category: draft.category || null,
        media_url: draft.media_url || null,
        images: draft.images,
        body_html: draft.body_html,
        order_index: nextOrder,
      });
      if (error) return toastError("יצירת התבנית נכשלה.");
    }
    toast({ title: "נשמר", variant: "success" });
    refreshTemplates();
  }

  async function removeTemplate(t: GuideTemplate) {
    const { error } = await supabase.from("guide_templates").delete().eq("id", t.id);
    if (error) return toastError("המחיקה נכשלה.");
    refreshTemplates();
  }

  /* -------- credential mutations -------- */
  async function saveCred(d: CredDraft) {
    const payload = {
      label: clampText(d.label.trim(), 80) || "ניהול האתר",
      login_url: d.login_url.trim() || null,
      username: d.username.trim() || null,
      password_reset_url: d.password_reset_url.trim() || null,
      note: clampText(d.note.trim(), 400) || null,
    };
    if (credSheet.editing) {
      const { error } = await supabase.from("project_site_credentials").update({ ...payload, updated_at: new Date().toISOString() }).eq("id", credSheet.editing.id);
      if (error) return toastError("השמירה נכשלה.");
    } else {
      const nextOrder = (creds?.reduce((m, c) => Math.max(m, c.order_index), -1) ?? -1) + 1;
      const { error } = await supabase.from("project_site_credentials").insert({ project_id: projectId, ...payload, order_index: nextOrder });
      if (error) return toastError("השמירה נכשלה.");
    }
    toast({ title: "נשמר", variant: "success" });
    refreshCreds();
  }

  async function removeCred(c: ProjectSiteCredential) {
    const { error } = await supabase.from("project_site_credentials").delete().eq("id", c.id);
    if (error) return toastError("המחיקה נכשלה.");
    refreshCreds();
  }

  const articleInitial: GuideDraft = articleSheet.editing
    ? {
        title: articleSheet.editing.title,
        icon: articleSheet.editing.icon ?? "post",
        category: articleSheet.editing.category ?? "",
        media_url: articleSheet.editing.media_url ?? "",
        images: articleSheet.editing.images ?? [],
        body_html: articleSheet.editing.body_html,
        is_published: articleSheet.editing.is_published,
      }
    : emptyDraft();

  const templateInitial: GuideDraft = templateSheet.editing
    ? {
        title: templateSheet.editing.title,
        icon: templateSheet.editing.icon ?? "post",
        category: templateSheet.editing.category ?? "",
        media_url: templateSheet.editing.media_url ?? "",
        images: templateSheet.editing.images ?? [],
        body_html: templateSheet.editing.body_html,
        is_published: true,
      }
    : emptyDraft();

  return (
    <Card className="p-5">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <BookOpen className="size-5 text-brand-cyan-base" />
          <h2 className="font-heading text-lg font-semibold text-foreground">מדריך שימוש לאתר</h2>
        </div>
        {isAdmin && (
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" onClick={() => setTemplatesOpen(true)}>
              <LibraryBig className="size-4" /> תבניות
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setArticleSheet({ open: true, editing: null })}>
              <Plus className="size-4" /> מדריך
            </Button>
          </div>
        )}
      </div>

      {/* credentials */}
      <div className="mb-5 space-y-3">
        {(creds ?? []).map((c) => (
          <CredentialCard
            key={c.id}
            cred={c}
            isAdmin={isAdmin}
            onEdit={() => setCredSheet({ open: true, editing: c })}
            onDelete={() => removeCred(c)}
          />
        ))}
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={() => setCredSheet({ open: true, editing: null })}>
            <KeyRound className="size-4" /> פרטי התחברות
          </Button>
        )}
      </div>

      {/* admin: attach a studio template */}
      {isAdmin && (templates?.length ?? 0) > 0 && (
        <div className="mb-4 flex items-center gap-2">
          <span className="text-sm text-muted-foreground">הוסף מתבנית:</span>
          <SelectMenu
            value=""
            placeholder="בחר תבנית…"
            onChange={(v) => v && attachTemplate(v)}
            options={(templates ?? []).map((t) => ({ value: t.id, label: t.title }))}
            ariaLabel="הוסף מתבנית"
          />
        </div>
      )}

      {/* articles */}
      {isLoading ? (
        <Skeleton className="h-24 w-full rounded-xl" />
      ) : !articles?.length ? (
        <EmptyState icon={BookOpen} title="עדיין אין מדריך" description={isAdmin ? "הוסף מדריך חדש או טען מתבנית." : "המדריך יעלה כאן בקרוב."} />
      ) : (
        <div className="grid gap-4 md:grid-cols-[240px_1fr]">
          <ul className="space-y-1">
            {articles.map((a) => {
              const Icon = iconFor(a.icon);
              return (
                <li key={a.id}>
                  <button
                    onClick={() => setSelectedId(a.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-sm transition-colors",
                      selected?.id === a.id ? "bg-primary/15 text-primary" : "text-foreground hover:bg-field",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className="truncate">{a.title}</span>
                    {!a.is_published && <EyeOff className="ms-auto size-3.5 shrink-0 text-muted-foreground" />}
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="min-w-0">
            {selected ? (
              <article className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    {selected.category && (
                      <Badge variant="secondary" className="mb-1">{selected.category}</Badge>
                    )}
                    <h3 className="font-heading text-xl font-semibold text-foreground">{selected.title}</h3>
                  </div>
                  {isAdmin && (
                    <div className="flex flex-wrap items-center gap-1">
                      <Button variant="ghost" size="icon" className="size-8" aria-label="למעלה" onClick={() => move(selected, -1)}>
                        <ArrowUp className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8" aria-label="למטה" onClick={() => move(selected, 1)}>
                        <ArrowDown className="size-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => togglePublish(selected)}>
                        {selected.is_published ? <><EyeOff className="size-4" /> טיוטה</> : <><Eye className="size-4" /> פרסם</>}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => saveAsTemplate(selected)}>
                        <LibraryBig className="size-4" /> כתבנית
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8" aria-label="עריכה" onClick={() => setArticleSheet({ open: true, editing: selected })}>
                        <Pencil className="size-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8 text-destructive" aria-label="מחיקה" onClick={() => removeArticle(selected)}>
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {selected.media_url && <MediaEmbed url={selected.media_url} />}

                <div
                  dir="rtl"
                  className="rte-content max-w-none rounded-xl border border-border bg-background/20 p-4"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(selected.body_html) }}
                />

                {selected.images?.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {selected.images.map((url, i) => (
                      <button
                        key={url}
                        type="button"
                        onClick={() => setLightbox(i)}
                        className="block overflow-hidden rounded-lg border border-border transition hover:border-primary/40"
                      >
                        <img src={url} alt="" loading="lazy" className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </article>
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">בחר מדריך</p>
            )}
          </div>
        </div>
      )}

      {/* article editor */}
      {articleSheet.open && (
        <GuideEditorSheet
          open={articleSheet.open}
          onOpenChange={(v) => setArticleSheet((s) => ({ ...s, open: v }))}
          initial={articleInitial}
          heading={articleSheet.editing ? "עריכת מדריך" : "מדריך חדש"}
          showPublish
          onSave={saveArticle}
        />
      )}

      {/* template editor */}
      {templateSheet.open && (
        <GuideEditorSheet
          open={templateSheet.open}
          onOpenChange={(v) => setTemplateSheet((s) => ({ ...s, open: v }))}
          initial={templateInitial}
          heading={templateSheet.editing ? "עריכת תבנית" : "תבנית חדשה"}
          showPublish={false}
          onSave={saveTemplate}
        />
      )}

      {/* templates library */}
      <Sheet open={templatesOpen} onOpenChange={setTemplatesOpen}>
        <SheetContent className="flex w-full flex-col gap-4 sm:max-w-md">
          <SheetHeader>
            <SheetTitle>ספריית תבניות</SheetTitle>
            <SheetDescription>מדריכים גנריים שכתובים פעם אחת ונטענים לכל פרויקט.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-2 overflow-y-auto pe-1">
            {!templates?.length ? (
              <EmptyState icon={LibraryBig} title="אין עדיין תבניות" />
            ) : (
              templates.map((t) => {
                const Icon = iconFor(t.icon);
                return (
                  <div key={t.id} className="flex items-center gap-2 rounded-lg border border-border bg-background/30 px-3 py-2">
                    <Icon className="size-4 shrink-0 text-brand-cyan-base" />
                    <span className="truncate text-sm text-foreground">{t.title}</span>
                    <div className="ms-auto flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="size-7" aria-label="עריכה" onClick={() => setTemplateSheet({ open: true, editing: t })}>
                        <Pencil className="size-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-7 text-destructive" aria-label="מחיקה" onClick={() => removeTemplate(t)}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          <SheetFooter>
            <Button onClick={() => setTemplateSheet({ open: true, editing: null })}>
              <Plus className="size-4" /> תבנית חדשה
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* credentials editor */}
      {credSheet.open && (
        <CredentialSheet
          open={credSheet.open}
          onOpenChange={(v) => setCredSheet((s) => ({ ...s, open: v }))}
          initial={credSheet.editing}
          onSave={saveCred}
        />
      )}

      {/* in-app image lightbox */}
      {lightbox !== null && selected?.images?.[lightbox] && (
        <Lightbox
          images={selected.images}
          index={lightbox}
          onClose={() => setLightbox(null)}
          onNav={setLightbox}
        />
      )}
    </Card>
  );
}

/* ---------------- credential editor sheet ---------------- */

function CredentialSheet({
  open,
  onOpenChange,
  initial,
  onSave,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: ProjectSiteCredential | null;
  onSave: (d: CredDraft) => void | Promise<unknown>;
}) {
  const [d, setD] = useState<CredDraft>({
    label: initial?.label ?? "ניהול האתר",
    login_url: initial?.login_url ?? "",
    username: initial?.username ?? "",
    password_reset_url: initial?.password_reset_url ?? "",
    note: initial?.note ?? "",
  });
  const [saving, setSaving] = useState(false);

  function set<K extends keyof CredDraft>(k: K, v: CredDraft[K]) {
    setD((p) => ({ ...p, [k]: v }));
  }

  async function submit() {
    setSaving(true);
    await onSave(d);
    setSaving(false);
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-4 sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{initial ? "עריכת פרטי התחברות" : "פרטי התחברות לאתר"}</SheetTitle>
          <SheetDescription>לא נשמרת סיסמה. כתובת ניהול, שם משתמש, וקישור לאיפוס סיסמה בלבד.</SheetDescription>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto pe-1">
          <div className="space-y-1.5">
            <Label htmlFor="c-label">כותרת</Label>
            <Input id="c-label" maxLength={80} value={d.label} onChange={(e) => set("label", e.target.value)} placeholder="ניהול האתר (WordPress)" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-url">כתובת ניהול</Label>
            <Input id="c-url" dir="ltr" value={d.login_url} onChange={(e) => set("login_url", e.target.value)} placeholder="https://yoursite.com/wp-admin" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-user">שם משתמש</Label>
            <Input id="c-user" dir="ltr" value={d.username} onChange={(e) => set("username", e.target.value)} placeholder="client@yoursite.com" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-reset">קישור לאיפוס סיסמה (רשות)</Label>
            <Input id="c-reset" dir="ltr" value={d.password_reset_url} onChange={(e) => set("password_reset_url", e.target.value)} placeholder="https://yoursite.com/wp-login.php?action=lostpassword" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c-note">הערה (רשות)</Label>
            <Textarea id="c-note" rows={3} maxLength={400} value={d.note} onChange={(e) => set("note", e.target.value)} placeholder="שלחנו לך את הסיסמה בוואטסאפ. מומלץ להחליף בכניסה הראשונה." />
          </div>
        </div>
        <SheetFooter>
          <Button onClick={submit} disabled={saving}>{saving ? "שומר…" : "שמירה"}</Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
