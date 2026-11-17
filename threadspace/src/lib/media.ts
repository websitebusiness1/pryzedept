import { supabase } from './supabase';
import { optimizeImage } from './image';
import type { MediaAsset } from './types';

export const SITE_BUCKET = 'site-media';
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const VIDEO_TYPES: Record<string, string> = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/gif';
export const VIDEO_ACCEPT = Object.keys(VIDEO_TYPES).join(',');

export const publicMediaUrl = (path: string | null | undefined): string | null =>
  path ? supabase.storage.from(SITE_BUCKET).getPublicUrl(path).data.publicUrl : null;

const baseName = (name: string) => name.replace(/\.[^.]+$/, '').slice(0, 120);

export function validateVideoFile(file: File): string | null {
  if (!VIDEO_TYPES[file.type]) return 'Use an MP4, WebM or MOV video.';
  if (file.size > MAX_VIDEO_BYTES) return `Videos must be 50 MB or smaller. For larger videos, upload to YouTube or Vimeo and paste the link.`;
  return null;
}

async function register(row: Omit<MediaAsset, 'id' | 'created_at' | 'updated_at'>, path: string): Promise<MediaAsset> {
  const { data, error } = await supabase.from('media_assets').insert(row).select('*').single();
  if (error) {
    await supabase.storage.from(SITE_BUCKET).remove([path]).catch(() => undefined);   // don't leave an orphan file behind
    throw error;
  }
  return data as MediaAsset;
}

/** Optimizes, uploads to {store}/img-xxxx and records it in the media library. */
export async function uploadSiteImage(storeId: string, file: File, category = 'General'): Promise<MediaAsset> {
  const opt = await optimizeImage(file);
  const path = `${storeId}/img-${crypto.randomUUID()}.${opt.ext}`;
  const { error } = await supabase.storage.from(SITE_BUCKET).upload(path, opt.blob, { contentType: opt.type, upsert: false, cacheControl: '3600' });
  if (error) throw error;
  return register({ store_id: storeId, kind: 'image', storage_path: path, title: baseName(file.name), alt_text: '', category, size_bytes: opt.blob.size, width: opt.width, height: opt.height, sort_order: 0 }, path);
}

export async function uploadSiteVideo(storeId: string, file: File, category = 'Videos'): Promise<MediaAsset> {
  const bad = validateVideoFile(file);
  if (bad) throw new Error(bad);
  const path = `${storeId}/vid-${crypto.randomUUID()}.${VIDEO_TYPES[file.type]}`;
  const { error } = await supabase.storage.from(SITE_BUCKET).upload(path, file, { contentType: file.type, upsert: false, cacheControl: '3600' });
  if (error) throw error;
  return register({ store_id: storeId, kind: 'video', storage_path: path, title: baseName(file.name), alt_text: '', category, size_bytes: file.size, width: null, height: null, sort_order: 0 }, path);
}

/** Replaces the file but keeps the same address, so everything that already uses it updates automatically. */
export async function replaceSiteImage(asset: MediaAsset, file: File): Promise<MediaAsset> {
  const opt = await optimizeImage(file);
  const { error } = await supabase.storage.from(SITE_BUCKET).upload(asset.storage_path, opt.blob, { contentType: opt.type, upsert: true, cacheControl: '3600' });
  if (error) throw error;
  const { data, error: err } = await supabase.from('media_assets')
    .update({ size_bytes: opt.blob.size, width: opt.width, height: opt.height, updated_at: new Date().toISOString() })
    .eq('id', asset.id).select('*').single();
  if (err) throw err;
  return data as MediaAsset;
}

export async function removeSiteAsset(asset: MediaAsset): Promise<void> {
  const { error } = await supabase.storage.from(SITE_BUCKET).remove([asset.storage_path]);
  if (error) throw error;
  const { error: err } = await supabase.from('media_assets').delete().eq('id', asset.id);
  if (err) throw err;
}

export async function pathsInUse(storeId: string): Promise<Set<string>> {
  const { data, error } = await supabase.rpc('media_paths_in_use', { p_store_id: storeId });
  if (error) throw error;
  return new Set(((data ?? []) as { storage_path: string }[]).map((r) => r.storage_path));
}

/** Registers a file that is already in the bucket (not needed in normal use). */
export const mediaSize = (n: number | null) => (n == null ? '' : n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
