import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/format';
import { IMAGE_ACCEPT, VIDEO_ACCEPT, publicMediaUrl, uploadSiteImage, uploadSiteVideo, validateVideoFile } from '@/lib/media';
import { validateImage } from '@/lib/storage';
import type { MediaAsset } from '@/lib/types';
import { Alert, Spinner } from './ui';

interface Props { storeId: string; kind: 'image' | 'video'; onSelect: (a: MediaAsset) => void; onClose: () => void }

/** Choose something from the media library, or upload new files (which are also added to the library). */
export default function MediaPicker({ storeId, kind, onSelect, onClose }: Props) {
  const [tab, setTab] = useState<'library' | 'upload'>('library');
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('all');
  const [uploadCategory, setUploadCategory] = useState('General');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from('media_assets').select('*').eq('store_id', storeId).eq('kind', kind)
      .order('sort_order').order('created_at', { ascending: false });
    if (err) setError(errorMessage(err));
    setAssets((data ?? []) as MediaAsset[]);
    setLoading(false);
  }, [storeId, kind]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const categories = useMemo(() => Array.from(new Set(assets.map((a) => a.category || 'General'))).sort(), [assets]);
  const shown = assets.filter((a) => category === 'all' || (a.category || 'General') === category);

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setBusy(true);
    let last: MediaAsset | null = null;
    const problems: string[] = [];
    for (const file of Array.from(files)) {
      const bad = kind === 'image' ? validateImage(file) : validateVideoFile(file);
      if (bad) { problems.push(`${file.name}: ${bad}`); continue; }
      try { last = kind === 'image' ? await uploadSiteImage(storeId, file, uploadCategory) : await uploadSiteVideo(storeId, file, uploadCategory); }
      catch (e) { problems.push(`${file.name}: ${errorMessage(e)}`); }
    }
    setBusy(false);
    if (problems.length) setError(problems.join(' '));
    await load();
    if (last && problems.length === 0 && files.length === 1) onSelect(last);
    else if (last) setTab('library');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`Choose ${kind}`} className="flex max-h-[90vh] w-full max-w-3xl flex-col bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-sand-200 px-5 py-3">
          <h2 className="font-display text-xl">Choose {kind === 'image' ? 'an image' : 'a video'}</h2>
          <button ref={closeRef} type="button" className="btn-quiet px-3 py-1.5" onClick={onClose}>Close</button>
        </div>
        <div className="flex gap-1 border-b border-sand-200 px-5">
          {(['library', 'upload'] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={`border-b-2 px-3 py-3 text-sm font-semibold ${tab === t ? 'border-black' : 'border-transparent text-sand-500'}`}>{t === 'library' ? 'Media library' : 'Upload new'}</button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {error && <div className="mb-4"><Alert>{error}</Alert></div>}
          {tab === 'library' ? (
            loading ? <div className="py-12 text-center"><Spinner className="h-6 w-6" /></div> : assets.length === 0 ? (
              <p className="py-12 text-center text-sm text-sand-500">Nothing in your library yet. Use “Upload new”.</p>
            ) : (
              <>
                <select aria-label="Filter by category" className="input mb-4 w-auto" value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="all">All categories</option>
                  {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {shown.map((a) => (
                    <li key={a.id}>
                      <button type="button" className="group block w-full text-left" onClick={() => onSelect(a)}>
                        <span className="block aspect-square overflow-hidden border border-sand-200 bg-sand-50 group-hover:border-black">
                          {kind === 'image' ? <img src={publicMediaUrl(a.storage_path) ?? ''} alt={a.alt_text || a.title || ''} loading="lazy" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-xs text-sand-500">Video</span>}
                        </span>
                        <span className="mt-1 block truncate text-xs">{a.title || 'Untitled'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )
          ) : (
            <div className="space-y-4">
              <div className="max-w-xs">
                <label htmlFor="mp-cat" className="label">Category</label>
                <input id="mp-cat" className="input" maxLength={60} value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value)} />
              </div>
              <label className={`btn-primary cursor-pointer ${busy ? 'pointer-events-none opacity-50' : ''}`}>
                {busy && <Spinner />} {busy ? 'Uploading…' : `Choose ${kind === 'image' ? 'images' : 'a video'}`}
                <input type="file" className="sr-only" multiple={kind === 'image'} accept={kind === 'image' ? IMAGE_ACCEPT : VIDEO_ACCEPT} disabled={busy} onChange={(e) => { onFiles(e.target.files); e.target.value = ''; }} />
              </label>
              <p className="hint">{kind === 'image' ? 'Large photos are resized and compressed automatically, with no visible loss. JPEG, PNG, WebP, AVIF or GIF.' : 'MP4, WebM or MOV up to 50 MB. For longer videos, use a YouTube or Vimeo link instead.'}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
