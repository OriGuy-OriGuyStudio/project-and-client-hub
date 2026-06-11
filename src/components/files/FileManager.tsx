import { useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Download,
  Folder,
  FolderPlus,
  FolderOpen,
  Lock,
  Trash2,
  Upload,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/sheet";
import { FilePreview } from "./FilePreview";
import { supabase } from "@/lib/supabase";
import {
  deleteProjectFile,
  downloadFilesAsZip,
  getSignedUrl,
  humanSize,
  uploadProjectFile,
  validateFile,
} from "@/lib/files";
import { toast, toastError } from "@/hooks/use-toast";
import { logActivity } from "@/lib/activity";
import { clampText } from "@/lib/sanitize";
import { cn } from "@/lib/utils";
import type { FileRow, ProjectFolder } from "@/types/database";

const ROOT = "/";

export function FileManager({
  projectId,
  isAdmin,
  actorId,
  zipName,
}: {
  projectId: string;
  isAdmin: boolean;
  actorId: string | null;
  zipName: string;
}) {
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [zipping, setZipping] = useState(false);
  const [current, setCurrent] = useState<string>(ROOT);
  const [newFolder, setNewFolder] = useState("");
  const [addingFolder, setAddingFolder] = useState(false);
  const [confirmFolder, setConfirmFolder] = useState<string | null>(null);
  const [deletingFolder, setDeletingFolder] = useState(false);

  const { data: files, isLoading } = useQuery({
    queryKey: ["files", projectId],
    queryFn: async (): Promise<FileRow[]> => {
      const { data, error } = await supabase
        .from("files")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: folderRows } = useQuery({
    queryKey: ["folders", projectId],
    queryFn: async (): Promise<ProjectFolder[]> => {
      const { data, error } = await supabase
        .from("project_folders")
        .select("*")
        .eq("project_id", projectId)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  // Folder list = declared folders ∪ folders implied by existing files.
  const folders = useMemo(() => {
    const names = new Set<string>();
    folderRows?.forEach((f) => names.add(f.name));
    files?.forEach((f) => {
      if (f.folder_path && f.folder_path !== ROOT) names.add(f.folder_path);
    });
    return [...names].sort((a, b) => a.localeCompare(b, "he"));
  }, [folderRows, files]);

  const fileCount = (folder: string) =>
    files?.filter((f) =>
      folder === ROOT
        ? !f.folder_path || f.folder_path === ROOT
        : f.folder_path === folder
    ).length ?? 0;

  const visibleFiles =
    files?.filter((f) =>
      current === ROOT
        ? !f.folder_path || f.folder_path === ROOT
        : f.folder_path === current
    ) ?? [];

  const refreshFiles = () => qc.invalidateQueries({ queryKey: ["files", projectId] });
  const refreshFolders = () => qc.invalidateQueries({ queryKey: ["folders", projectId] });

  async function createFolder() {
    const name = clampText(newFolder.trim(), 80);
    if (!name || name === ROOT) return;
    const { error } = await supabase
      .from("project_folders")
      .insert({ project_id: projectId, name, created_by: actorId });
    if (error) {
      toastError(error.code === "23505" ? "כבר קיימת תיקייה בשם הזה." : "יצירת התיקייה נכשלה.");
      return;
    }
    setNewFolder("");
    setAddingFolder(false);
    refreshFolders();
    setCurrent(name);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files ? Array.from(e.target.files) : [];
    if (inputRef.current) inputRef.current.value = "";
    if (!list.length) return;

    setUploading(true);
    let ok = 0;
    for (const file of list) {
      const err = validateFile(file);
      if (err) {
        toastError(`${file.name}: ${err}`);
        continue;
      }
      try {
        await uploadProjectFile({
          projectId,
          file,
          uploadedBy: actorId,
          folderPath: current,
        });
        ok++;
      } catch {
        toastError(`העלאת ${file.name} נכשלה.`);
      }
    }
    setUploading(false);
    if (ok > 0) {
      await logActivity({
        projectId,
        actorId,
        actionType: "file_uploaded",
        description:
          ok === 1 ? `הועלה קובץ${current !== ROOT ? ` לתיקייה ${current}` : ""}` : `הועלו ${ok} קבצים`,
      });
      toast({ title: ok === 1 ? "הקובץ הועלה" : `${ok} קבצים הועלו`, variant: "success" });
      refreshFiles();
    }
  }

  async function download(file: FileRow) {
    const url = await getSignedUrl(file.storage_path);
    if (!url) return toastError("יצירת קישור ההורדה נכשלה.");
    window.open(url, "_blank", "noopener");
  }

  async function remove(file: FileRow) {
    try {
      await deleteProjectFile(file);
      refreshFiles();
    } catch {
      toastError("מחיקת הקובץ נכשלה.");
    }
  }

  async function confirmDeleteFolder() {
    const name = confirmFolder;
    if (!name) return;
    setDeletingFolder(true);
    try {
      // Delete every file inside the folder (storage object + metadata row).
      const inFolder = files?.filter((f) => f.folder_path === name) ?? [];
      for (const f of inFolder) {
        await deleteProjectFile(f);
      }
      await supabase
        .from("project_folders")
        .delete()
        .eq("project_id", projectId)
        .eq("name", name);
      if (inFolder.length) {
        await logActivity({
          projectId,
          actorId,
          actionType: "folder_deleted",
          description: `נמחקה התיקייה "${name}" (${inFolder.length} קבצים)`,
        });
      }
      if (current === name) setCurrent(ROOT);
      setConfirmFolder(null);
      refreshFiles();
      refreshFolders();
    } catch {
      toastError("מחיקת התיקייה נכשלה.");
    } finally {
      setDeletingFolder(false);
    }
  }

  async function zipDownload(scope: "folder" | "all") {
    const list = scope === "all" ? files ?? [] : visibleFiles;
    if (!list.length) return toastError("אין קבצים להורדה.");
    setZipping(true);
    try {
      const name =
        scope === "all" ? `${zipName} - קבצים` : current === ROOT ? `${zipName} - ראשי` : current;
      const n = await downloadFilesAsZip(list, name, scope === "all");
      if (n === 0) toastError("הורדת הקבצים נכשלה.");
    } catch {
      toastError("הכנת ה-ZIP נכשלה.");
    } finally {
      setZipping(false);
    }
  }

  const folderRecord = (name: string) => folderRows?.find((f) => f.name === name);

  return (
    <Card className="p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FolderOpen className="size-5 text-brand-cyan-base" />
          <h2 className="font-heading text-lg font-semibold text-foreground">קבצים ותיקיות</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setAddingFolder((v) => !v)}>
            <FolderPlus className="size-4" /> תיקייה
          </Button>
          {!!files?.length && (
            <Button size="sm" variant="secondary" onClick={() => zipDownload("all")} disabled={zipping}>
              <Download className="size-4" /> {zipping ? "מכין…" : "הורד הכל"}
            </Button>
          )}
          <Button size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
            <Upload className="size-4" /> {uploading ? "מעלה…" : "העלאה"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleUpload}
            accept=".jpg,.jpeg,.png,.webp,.svg,.pdf,.doc,.docx,.zip"
          />
        </div>
      </div>

      {addingFolder && (
        <div className="mb-4 flex items-center gap-2">
          <Input
            placeholder="שם התיקייה (לדוגמה: פרויקט שדרה 12)"
            maxLength={80}
            value={newFolder}
            onChange={(e) => setNewFolder(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createFolder()}
          />
          <Button size="sm" onClick={createFolder}>
            יצירה
          </Button>
        </div>
      )}

      {/* Folder bar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <FolderChip
          label="ראשי"
          count={fileCount(ROOT)}
          active={current === ROOT}
          onClick={() => setCurrent(ROOT)}
        />
        {folders.map((name) => (
          <FolderChip
            key={name}
            label={name}
            count={fileCount(name)}
            active={current === name}
            onClick={() => setCurrent(name)}
          />
        ))}
      </div>

      {/* Current-folder toolbar */}
      {current !== ROOT && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-border bg-background/30 px-4 py-2">
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Folder className="size-4 text-brand-cyan-base" /> {current}
          </span>
          <div className="flex items-center gap-1">
            {visibleFiles.length > 0 && (
              <Button size="sm" variant="ghost" onClick={() => zipDownload("folder")} disabled={zipping}>
                <Download className="size-4" /> הורד תיקייה
              </Button>
            )}
            {(isAdmin || folderRecord(current)?.created_by === actorId) && (
              <Button
                size="sm"
                variant="ghost"
                className="text-destructive"
                aria-label="מחיקת תיקייה"
                onClick={() => setConfirmFolder(current)}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : !visibleFiles.length ? (
        <EmptyState
          icon={FolderOpen}
          title={current === ROOT ? "אין עדיין קבצים" : "התיקייה ריקה"}
          description="העלה קבצים — תמונות, PDF, Word או ZIP עד 50MB. אפשר לסדר אותם בתיקיות."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleFiles.map((file) => (
            <div
              key={file.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-background/30 p-3"
            >
              <FilePreview file={file} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="truncate font-mono-code text-sm text-foreground">
                    {file.file_name}
                  </p>
                  {file.is_private && (
                    <Badge variant="secondary" className="shrink-0">
                      <Lock className="size-3" /> אדמין
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {humanSize(file.file_size)} ·{" "}
                  {new Date(file.created_at).toLocaleDateString("he-IL")}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="ghost" onClick={() => download(file)}>
                  <Download className="size-4" /> הורדה
                </Button>
                {(isAdmin || file.uploaded_by === actorId) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={() => remove(file)}
                    aria-label="מחיקה"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!confirmFolder} onOpenChange={(o) => !o && setConfirmFolder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>מחיקת תיקייה</DialogTitle>
            <DialogDescription>
              {confirmFolder && fileCount(confirmFolder) > 0
                ? `התיקייה "${confirmFolder}" מכילה ${fileCount(confirmFolder)} קבצים. מחיקתה תמחק גם את כל הקבצים שבתוכה. אי אפשר לבטל.`
                : `למחוק את התיקייה "${confirmFolder}"?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="destructive" onClick={confirmDeleteFolder} disabled={deletingFolder}>
              <Trash2 className="size-4" />
              {deletingFolder ? "מוחק…" : "מחיקה"}
            </Button>
            <Button variant="ghost" onClick={() => setConfirmFolder(null)}>
              ביטול
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function FolderChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors",
        active
          ? "border-primary/50 bg-primary/15 text-primary"
          : "border-border text-muted-foreground hover:text-foreground"
      )}
    >
      <Folder className="size-4" />
      {label}
      <span className="text-xs opacity-70">{count}</span>
    </button>
  );
}
