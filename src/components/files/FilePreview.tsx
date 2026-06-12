import { useEffect, useState } from "react";
import { FileText, ImageIcon } from "lucide-react";
import { getSignedUrl, isImage, isPdf } from "@/lib/files";
import { Skeleton } from "@/components/ui/skeleton";
import type { FileRow } from "@/types/database";

/** Inline preview for images / PDFs via a freshly-minted signed URL. */
export function FilePreview({ file }: { file: FileRow }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const previewable = isImage(file.mime_type) || isPdf(file.mime_type);

  useEffect(() => {
    if (!previewable) {
      setLoading(false);
      return;
    }
    let active = true;
    getSignedUrl(file.storage_path).then((u) => {
      if (active) {
        setUrl(u);
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [file.storage_path, previewable]);

  if (!previewable) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg bg-field text-muted-foreground">
        <FileText className="size-8" />
      </div>
    );
  }

  if (loading) return <Skeleton className="h-32 w-full rounded-lg" />;

  if (!url) {
    return (
      <div className="flex h-32 items-center justify-center rounded-lg bg-field text-muted-foreground">
        <ImageIcon className="size-8" />
      </div>
    );
  }

  return isImage(file.mime_type) ? (
    <img
      src={url}
      alt={file.file_name}
      className="h-32 w-full rounded-lg object-cover"
    />
  ) : (
    <iframe
      src={url}
      title={file.file_name}
      className="h-32 w-full rounded-lg border border-border bg-white"
    />
  );
}
