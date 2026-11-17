import { IMAGE_BUCKET, supabase } from './supabase';
import { optimizeImage } from './image';

export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'image/gif': 'gif',
};
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** Client-side check for a friendly message. The bucket enforces the same limits on the server. */
export function validateImage(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES[file.type]) return 'Use a JPEG, PNG, WebP, AVIF or GIF image.';
  if (file.size > MAX_IMAGE_BYTES) return 'Images must be 5 MB or smaller.';
  return null;
}

/** Optimizes, then uploads to {store_uuid}/{prefix}-{random}.{ext}. A fresh name each time so nothing is overwritten. */
export async function uploadStoreImage(storeId: string, file: File, prefix: string): Promise<string> {
  const opt = await optimizeImage(file);
  const path = `${storeId}/${prefix}-${crypto.randomUUID()}.${opt.ext}`;
  const { error } = await supabase.storage
    .from(IMAGE_BUCKET)
    .upload(path, opt.blob, { contentType: opt.type, upsert: false, cacheControl: '3600' });
  if (error) throw error;
  return path;
}

export async function removeImage(path: string): Promise<void> {
  const { error } = await supabase.storage.from(IMAGE_BUCKET).remove([path]);
  if (error) throw error;
}

export function publicImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from(IMAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}
