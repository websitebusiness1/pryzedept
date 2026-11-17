export interface OptimizedImage { blob: Blob; type: string; ext: string; width: number | null; height: number | null }

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif', 'image/gif': 'gif' };

async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; close?: () => void }> {
  if ('createImageBitmap' in window) {
    try {
      const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });   // respects phone photo rotation
      return { source: bmp, width: bmp.width, height: bmp.height, close: () => bmp.close() };
    } catch { /* fall back below */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('Could not read this image.')); i.src = url; });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight };
  } finally { URL.revokeObjectURL(url); }
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((res) => canvas.toBlob(res, type, quality));

/**
 * Shrinks big photos before upload: longest side capped at 2200px, re-encoded as WebP at high quality.
 * That keeps pages fast with no visible loss. Animated GIFs are left untouched, and a file that is
 * already small is never made bigger.
 */
export async function optimizeImage(file: File, maxEdge = 2200, quality = 0.88): Promise<OptimizedImage> {
  const original: OptimizedImage = { blob: file, type: file.type, ext: EXT[file.type] ?? 'jpg', width: null, height: null };
  if (file.type === 'image/gif') return original;
  let decoded: Awaited<ReturnType<typeof decode>>;
  try { decoded = await decode(file); } catch { return original; }
  try {
    const scale = Math.min(1, maxEdge / Math.max(decoded.width, decoded.height));
    const w = Math.max(1, Math.round(decoded.width * scale));
    const h = Math.max(1, Math.round(decoded.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return { ...original, width: decoded.width, height: decoded.height };
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(decoded.source, 0, 0, w, h);
    let blob = await toBlob(canvas, 'image/webp', quality);
    if (!blob || blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', quality);
    if (!blob) return { ...original, width: decoded.width, height: decoded.height };
    // Keep the original if we didn't resize and the re-encode isn't smaller.
    if (scale === 1 && blob.size >= file.size) return { ...original, width: decoded.width, height: decoded.height };
    return { blob, type: blob.type, ext: EXT[blob.type] ?? 'jpg', width: w, height: h };
  } finally { decoded.close?.(); }
}
