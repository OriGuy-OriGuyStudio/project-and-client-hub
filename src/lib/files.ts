import { supabase, PROJECT_FILES_BUCKET, BRAND_ASSETS_BUCKET, SIGNED_URL_TTL } from "./supabase";
import type { FileRow } from "@/types/database";

export const MAX_FILE_BYTES = 50 * 1024 * 1024; // 50MB

/** Logos are small; mirror the brand-assets bucket's 5MB / image-only limits. */
export const MAX_BRAND_ASSET_BYTES = 5 * 1024 * 1024; // 5MB
const BRAND_ASSET_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
]);

/** Client-side gate for a logo upload (storage policy enforces the same). */
export function validateBrandAsset(file: File): string | null {
  if (file.size > MAX_BRAND_ASSET_BYTES) {
    return "הקובץ גדול מדי. הגודל המרבי ללוגו הוא 5MB.";
  }
  if (!BRAND_ASSET_MIME.has(file.type)) {
    return "סוג קובץ לא נתמך. אפשר PNG, JPG, WEBP או SVG.";
  }
  return null;
}

/**
 * Upload a brand asset (logo) to the PUBLIC brand-assets bucket and return its
 * stable public URL (suitable for a persisted <img src>). Admin-only per the
 * storage RLS. Path convention: <clientId>/<uuid>-<name>.
 */
export async function uploadBrandAsset(params: {
  clientId: string;
  file: File;
}): Promise<string> {
  const { clientId, file } = params;
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const storagePath = `${clientId}/${crypto.randomUUID()}-${safeName}`;

  const { error } = await supabase.storage
    .from(BRAND_ASSETS_BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (error) throw error;

  return supabase.storage.from(BRAND_ASSETS_BUCKET).getPublicUrl(storagePath).data
    .publicUrl;
}

// Mirrors the storage bucket's server-side allow-list exactly.
export const ALLOWED_MIME = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
  "application/x-zip-compressed",
]);

export function humanSize(bytes: number | null): string {
  if (!bytes) return "";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

/** Client-side gate (the storage policy enforces the same limits server-side). */
export function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_BYTES) {
    return "הקובץ גדול מדי. הגודל המרבי הוא 50MB.";
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return "סוג קובץ לא נתמך.";
  }
  return null;
}

export function isImage(mime: string | null) {
  return !!mime && mime.startsWith("image/");
}
export function isPdf(mime: string | null) {
  return mime === "application/pdf";
}

/** Upload bytes to the private bucket, then record metadata. */
export async function uploadProjectFile(params: {
  projectId: string;
  file: File;
  uploadedBy: string | null;
  folderPath?: string;
}): Promise<void> {
  const { projectId, file, uploadedBy, folderPath = "/" } = params;
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  // First path segment MUST be the project id (storage RLS relies on it).
  const storagePath = `${projectId}/${crypto.randomUUID()}-${safeName}`;

  const { error: upErr } = await supabase.storage
    .from(PROJECT_FILES_BUCKET)
    .upload(storagePath, file, { contentType: file.type, upsert: false });
  if (upErr) throw upErr;

  const { error: rowErr } = await supabase.from("files").insert({
    project_id: projectId,
    folder_path: folderPath,
    file_name: file.name,
    storage_path: storagePath,
    file_size: file.size,
    mime_type: file.type,
    uploaded_by: uploadedBy,
    is_private: false,
  });
  if (rowErr) {
    // Roll back the orphaned object on metadata failure.
    await supabase.storage.from(PROJECT_FILES_BUCKET).remove([storagePath]);
    throw rowErr;
  }
}

/** Mint a short-lived signed URL (1h). Requires passing the storage SELECT policy. */
export async function getSignedUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(PROJECT_FILES_BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL);
  if (error) return null;
  return data.signedUrl;
}

export async function deleteProjectFile(file: FileRow): Promise<void> {
  await supabase.storage.from(PROJECT_FILES_BUCKET).remove([file.storage_path]);
  const { error } = await supabase.from("files").delete().eq("id", file.id);
  if (error) throw error;
}

/**
 * Bundle files into a ZIP and trigger a download.
 * - `keepStructure`: place each file under its folder_path subdirectory
 *   (used for "download all"). Otherwise files go at the zip root
 *   (used for a single-folder download - the zip IS the folder).
 */
export async function downloadFilesAsZip(
  files: FileRow[],
  zipName: string,
  keepStructure: boolean
): Promise<number> {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const used = new Set<string>();
  let added = 0;

  for (const f of files) {
    const url = await getSignedUrl(f.storage_path);
    if (!url) continue;
    const blob = await fetch(url).then((r) => r.blob());

    const dir =
      keepStructure && f.folder_path && f.folder_path !== "/"
        ? `${f.folder_path}/`
        : "";
    // Avoid collisions if two files share a name in the same dir.
    let path = `${dir}${f.file_name}`;
    if (used.has(path)) {
      const dot = f.file_name.lastIndexOf(".");
      const base = dot > 0 ? f.file_name.slice(0, dot) : f.file_name;
      const ext = dot > 0 ? f.file_name.slice(dot) : "";
      let n = 1;
      while (used.has(`${dir}${base} (${n})${ext}`)) n++;
      path = `${dir}${base} (${n})${ext}`;
    }
    used.add(path);
    zip.file(path, blob);
    added++;
  }

  if (added === 0) return 0;

  const content = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  const objectUrl = URL.createObjectURL(content);
  a.href = objectUrl;
  a.download = `${(zipName || "files").replace(/[\\/:*?"<>|]+/g, "_")}.zip`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
  return added;
}
