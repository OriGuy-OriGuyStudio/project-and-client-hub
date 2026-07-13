import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  FileText,
  Heading2,
  Italic,
  List,
  ListOrdered,
  Lock,
  Plus,
  Trash2,
} from "lucide-react";
import { SectionShell } from "@/components/project/SectionShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { supabase } from "@/lib/supabase";
import { toast, toastError } from "@/hooks/use-toast";
import { sanitizeHtml, clampText } from "@/lib/sanitize";
import { cn } from "@/lib/utils";
import { useMyCapabilities } from "@/hooks/useMyCapabilities";
import type { ProjectDoc } from "@/types/database";

export function DocsSection({
  projectId,
  isAdmin,
  actorId,
}: {
  projectId: string;
  isAdmin: boolean;
  actorId: string | null;
}) {
  const qc = useQueryClient();
  // Creating/editing docs requires the files capability (a viewer is read-only).
  const { files: canFiles } = useMyCapabilities(isAdmin ? null : projectId);
  const canWrite = isAdmin || canFiles;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newTitle, setNewTitle] = useState("");
  const [adding, setAdding] = useState(false);

  const { data: docs, isLoading } = useQuery({
    queryKey: ["docs", projectId],
    queryFn: async (): Promise<ProjectDoc[]> => {
      const { data, error } = await supabase
        .from("project_docs")
        .select("*")
        .eq("project_id", projectId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["docs", projectId] });
  const selected = docs?.find((d) => d.id === selectedId) ?? null;

  async function createDoc() {
    const title = clampText(newTitle.trim(), 160);
    if (!title) return;
    const { data, error } = await supabase
      .from("project_docs")
      .insert({ project_id: projectId, title, created_by: actorId, updated_by: actorId })
      .select("id")
      .single();
    if (error || !data) return toastError("יצירת המסמך נכשלה.");
    setNewTitle("");
    setAdding(false);
    await refresh();
    setSelectedId(data.id);
  }

  async function saveContent(html: string) {
    if (!selected) return;
    const clean = sanitizeHtml(html);
    const { error } = await supabase
      .from("project_docs")
      .update({ content_html: clean, updated_by: actorId })
      .eq("id", selected.id);
    if (error) return toastError("שמירת המסמך נכשלה.");
    toast({ title: "המסמך נשמר", variant: "success" });
    refresh();
  }

  async function togglePrivate(doc: ProjectDoc) {
    const { error } = await supabase
      .from("project_docs")
      .update({ is_private: !doc.is_private })
      .eq("id", doc.id);
    if (error) return toastError("העדכון נכשל.");
    refresh();
  }

  async function remove(doc: ProjectDoc) {
    const { error } = await supabase.from("project_docs").delete().eq("id", doc.id);
    if (error) return toastError("המחיקה נכשלה.");
    if (selectedId === doc.id) setSelectedId(null);
    refresh();
  }

  return (
    <SectionShell
      icon={FileText}
      iconClass="text-brand-cyan-base"
      title="מסמכים"
      actions={
        canWrite ? (
          <Button size="sm" variant="ghost" onClick={() => setAdding((v) => !v)}>
            <Plus className="size-4" /> מסמך
          </Button>
        ) : null
      }
    >
      {adding && canWrite && (
        <div className="mb-4 flex items-center gap-2">
          <Input
            placeholder="שם המסמך (פרוטוקול, תוכן לאתר…)"
            maxLength={160}
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createDoc()}
          />
          <Button size="sm" onClick={createDoc}>
            יצירה
          </Button>
        </div>
      )}

      {isLoading ? (
        <Skeleton className="h-20 w-full rounded-xl" />
      ) : !docs?.length ? (
        <EmptyState icon={FileText} title="אין עדיין מסמכים" />
      ) : (
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <ul className="space-y-1">
            {docs.map((d) => (
              <li key={d.id}>
                <button
                  onClick={() => setSelectedId(d.id)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-start text-sm transition-colors",
                    selectedId === d.id
                      ? "bg-primary/15 text-primary"
                      : "text-foreground hover:bg-field"
                  )}
                >
                  <span className="truncate">{d.title}</span>
                  {d.is_private && <Lock className="size-3.5 shrink-0" />}
                </button>
              </li>
            ))}
          </ul>

          <div className="min-w-0">
            {selected ? (
              <DocEditor
                key={selected.id}
                doc={selected}
                isAdmin={isAdmin}
                onSave={saveContent}
                onTogglePrivate={() => togglePrivate(selected)}
                onDelete={() => remove(selected)}
              />
            ) : (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
                בחר מסמך לעריכה
              </p>
            )}
          </div>
        </div>
      )}
    </SectionShell>
  );
}

function DocEditor({
  doc,
  isAdmin,
  onSave,
  onTogglePrivate,
  onDelete,
}: {
  doc: ProjectDoc;
  isAdmin: boolean;
  onSave: (html: string) => void;
  onTogglePrivate: () => void;
  onDelete: () => void;
}) {
  const editor = useEditor({
    extensions: [StarterKit],
    content: doc.content_html || "<p></p>",
  });

  if (!editor) return <Skeleton className="h-40 w-full rounded-xl" />;

  const tools = [
    { icon: Bold, action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive("bold") },
    { icon: Italic, action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive("italic") },
    { icon: Heading2, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive("heading", { level: 2 }) },
    { icon: List, action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive("bulletList") },
    { icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive("orderedList") },
  ];

  return (
    <div className="space-y-2">
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
        <div className="ms-auto flex items-center gap-1">
          {isAdmin && (
            <>
              <Button variant="ghost" size="sm" onClick={onTogglePrivate}>
                {doc.is_private ? "הפוך לציבורי" : "סמן פרטי"}
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-destructive"
                aria-label="מחיקה"
                onClick={onDelete}
              >
                <Trash2 className="size-4" />
              </Button>
            </>
          )}
        </div>
      </div>

      <div dir="rtl" className="rte-content rounded-xl border border-border bg-background/30 p-4">
        <EditorContent editor={editor} />
      </div>

      <div className="flex items-center justify-between">
        {doc.is_private && (
          <Badge variant="secondary">
            <Lock className="size-3" /> פרטי
          </Badge>
        )}
        <Button size="sm" className="ms-auto" onClick={() => onSave(editor.getHTML())}>
          שמירה
        </Button>
      </div>
    </div>
  );
}
