import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/format';
import { useSiteSettings } from '@/lib/useSiteSettings';
import { useAuth } from '@/auth/AuthProvider';
import { Alert, EmptyState, PageHeader, PageLoader, Spinner } from '@/components/ui';

const DEVICES = {
  desktop: { label: 'Desktop', width: 1280, height: 800 },
  tablet: { label: 'Tablet', width: 820, height: 1050 },
  mobile: { label: 'Mobile', width: 390, height: 780 },
} as const;
type Device = keyof typeof DEVICES;

export default function Preview() {
  const { activeStore, isOwner } = useAuth();
  const storeId = activeStore?.store_id;
  const { settings, loading } = useSiteSettings(storeId);

  const [device, setDevice] = useState<Device>('desktop');
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [frameKey, setFrameKey] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  const box = useRef<HTMLDivElement>(null);

  const base = settings?.website_url?.replace(/\/+$/, '') ?? null;

  const newToken = useCallback(async () => {
    if (!storeId) return;
    setBusy(true); setError(null);
    const { data, error: err } = await supabase.rpc('create_preview_token', { p_store_id: storeId });
    setBusy(false);
    if (err) { setError(errorMessage(err)); return; }
    setToken(data as string);
    setFrameKey((k) => k + 1);
  }, [storeId]);

  useEffect(() => { if (base) newToken(); }, [base, newToken]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, [base, loading]);

  if (loading) return <PageLoader />;

  if (!base) {
    return (
      <div>
        <PageHeader title="Preview" description="See your website on desktop, tablet and mobile before you publish." />
        <EmptyState title="No website connected yet">
          {isOwner ? 'Add the website’s address in Brands & websites, then open this brand.' : 'The Pryze.dept team connects your website here. Once they do, you can preview it on this page.'}
        </EmptyState>
        {isOwner && <div className="mt-5 text-center"><Link to="/owner/stores" className="btn-outline">Go to Brands &amp; websites</Link></div>}
      </div>
    );
  }

  const d = DEVICES[device];
  const scale = width > 0 ? Math.min(1, width / d.width) : 1;
  const src = token ? `${base}/?preview=${encodeURIComponent(token)}` : null;
  const copy = async (label: string, text: string) => { try { await navigator.clipboard.writeText(text); setCopied(label); setTimeout(() => setCopied(null), 1800); } catch { /* clipboard unavailable */ } };

  return (
    <div>
      <PageHeader title="Preview" description="Your real website, showing drafts and hidden content, exactly as visitors will see it once published."
        actions={<>
          <button type="button" className="btn-outline" disabled={busy} onClick={newToken}>{busy && <Spinner />} Refresh</button>
          {src && <a className="btn-outline" href={src} target="_blank" rel="noopener noreferrer">Open in new tab</a>}
          <a className="btn-primary" href={base} target="_blank" rel="noopener noreferrer">View live website</a>
        </>} />
      {error && <div className="mb-4"><Alert>{error}</Alert></div>}

      <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Device size">
        {(Object.keys(DEVICES) as Device[]).map((k) => (
          <button key={k} type="button" aria-pressed={device === k} onClick={() => setDevice(k)}
            className={`border px-4 py-2 text-sm font-semibold ${device === k ? 'border-black bg-black text-white' : 'border-sand-300 hover:border-black'}`}>
            {DEVICES[k].label} <span className="font-normal opacity-70">{DEVICES[k].width}px</span>
          </button>
        ))}
        {src && <button type="button" className="btn-quiet ml-auto" onClick={() => copy('link', src)}>{copied === 'link' ? 'Copied' : 'Copy preview link'}</button>}
      </div>

      <div ref={box} className="w-full overflow-hidden bg-sand-100 p-0">
        <div style={{ width: d.width * scale, height: d.height * scale, margin: '0 auto' }}>
          {src ? (
            <iframe key={frameKey} title={`${d.label} preview of your website`} src={src}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              style={{ width: d.width, height: d.height, border: 0, background: '#fff', transform: `scale(${scale})`, transformOrigin: 'top left' }} />
          ) : <div className="flex h-full items-center justify-center"><Spinner className="h-6 w-6" /></div>}
        </div>
      </div>

      <div className="mt-6 space-y-2 text-sm text-sand-500">
        <p>The preview link works for 4 hours. Press Refresh for a new one, and after saving changes in the editors.</p>
        <p>
          Preview shows drafts, but anything you publish (or edit while it is published) is live immediately.
          If the preview stays blank, your website isn’t allowing this admin to display it. In the website’s Netlify settings, set the environment variable{' '}
          <code className="bg-sand-100 px-1.5 py-0.5 text-black">ADMIN_ORIGIN</code> to{' '}
          <button type="button" className="underline underline-offset-2" onClick={() => copy('origin', window.location.origin)}>{window.location.origin}</button>
          {copied === 'origin' && ' (copied)'}, then redeploy it.
        </p>
      </div>
    </div>
  );
}
