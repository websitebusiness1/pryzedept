import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/format';
import { useSiteSettings } from '@/lib/useSiteSettings';
import { Alert, Spinner } from './ui';

/** Owner-only: tells the admin which website belongs to a brand, and shows how a new website connects to it. */
export default function ConnectWebsite({ storeId, slug }: { storeId: string; slug: string }) {
  const { settings, loading, reload } = useSiteSettings(storeId);
  const [url, setUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { setUrl(settings?.website_url ?? ''); }, [settings]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null); setNotice(null);
    const v = url.trim().replace(/\/+$/, '');
    if (v && !/^https:\/\/[^\s/]+(\/\S*)?$/i.test(v)) { setError('The website address must start with https:// (for example https://yourbrand.com).'); return; }
    setSaving(true);
    const { error: err } = await supabase.from('site_settings').upsert({ store_id: storeId, website_url: v || null }, { onConflict: 'store_id' });
    setSaving(false);
    if (err) { setError(errorMessage(err)); return; }
    setNotice(v ? 'Website connected. The brand’s Preview now shows it.' : 'Website disconnected.');
    reload();
  }

  const env = [
    `VITE_SUPABASE_URL=${import.meta.env.VITE_SUPABASE_URL ?? ''}`,
    `VITE_SUPABASE_ANON_KEY=${import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''}`,
    `VITE_STORE_SLUG=${slug}`,
    `ADMIN_ORIGIN=${window.location.origin}`,
  ].join('\n');

  return (
    <div className="card space-y-5 p-5">
      {error && <Alert>{error}</Alert>}
      {notice && <Alert kind="success">{notice}</Alert>}
      <form onSubmit={save} className="space-y-2">
        <label htmlFor="site-url" className="label">Website address</label>
        <div className="flex flex-wrap gap-2">
          <input id="site-url" type="url" className="input max-w-md flex-1" placeholder="https://yourbrand.com" disabled={loading || saving} value={url} onChange={(e) => setUrl(e.target.value)} />
          <button type="submit" className="btn-primary" disabled={loading || saving}>{saving && <Spinner />} Save</button>
          {settings?.website_url && <a href={settings.website_url} target="_blank" rel="noopener noreferrer" className="btn-outline">Open website</a>}
        </div>
        <p className="hint">The separate website this brand’s admin controls. It’s used by the admin’s Preview, so the brand can see changes on desktop, tablet and mobile before publishing.</p>
      </form>

      <div className="border-t border-sand-200 pt-5">
        <h3 className="font-display text-lg">Connecting a new website</h3>
        <p className="mt-2 text-sm text-sand-500">
          Each website is its own project. To connect one to this brand, give it these environment variables (in Netlify: Site configuration, then Environment variables) and redeploy.
          The website then reads this brand’s products, lookbooks, videos, homepage sections and fonts, and sends orders back here.
        </p>
        <pre className="mt-3 overflow-x-auto bg-sand-50 p-3 text-xs leading-relaxed">{env}</pre>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <button type="button" className="btn-outline px-3 py-1.5" onClick={async () => { try { await navigator.clipboard.writeText(env); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* clipboard unavailable */ } }}>{copied ? 'Copied' : 'Copy'}</button>
          <span className="text-xs text-sand-500">The key is the public (publishable) key. Never use a secret or service-role key.</span>
        </div>
        <p className="mt-3 text-xs text-sand-500"><strong>ADMIN_ORIGIN</strong> lets this admin show the website inside Preview. Without it the preview stays blank.</p>
      </div>
    </div>
  );
}
