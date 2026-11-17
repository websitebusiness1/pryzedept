import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { errorMessage } from '@/lib/format';
import { FEATURES, FeatureKey, LIMITS, LimitKey, peso } from '@/lib/entitlements';
import { Alert, PageHeader, PageLoader, Spinner } from '@/components/ui';

interface Pkg { id: string; name: string; price_php: number; sort_order: number; features: Partial<Record<FeatureKey, boolean>>; limits: Partial<Record<LimitKey, number | null>> }

function PackageCard({ pkg, brands, onSaved }: { pkg: Pkg; brands: number; onSaved: () => void }) {
  const [name, setName] = useState(pkg.name);
  const [price, setPrice] = useState(String(pkg.price_php));
  const [features, setFeatures] = useState<Record<FeatureKey, boolean>>(() => Object.fromEntries(FEATURES.map((f) => [f.key, Boolean(pkg.features?.[f.key])])) as Record<FeatureKey, boolean>);
  const [limits, setLimits] = useState<Record<LimitKey, string>>(() => Object.fromEntries(LIMITS.map((l) => [l.key, pkg.limits?.[l.key] == null ? '' : String(pkg.limits[l.key])])) as Record<LimitKey, string>);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function save() {
    setError(null); setNotice(null);
    const p = Number(price);
    if (!name.trim()) { setError('Give the package a name.'); return; }
    if (price.trim() === '' || !Number.isFinite(p) || p < 0) { setError('Enter a valid price.'); return; }
    const lim: Record<string, number | null> = {};
    for (const l of LIMITS) {
      const raw = limits[l.key].trim();
      if (raw === '') { lim[l.key] = null; continue; }
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0 || n > 999999) { setError(`“${l.label}” must be a whole number, or empty for unlimited.`); return; }
      lim[l.key] = n;
    }
    setSaving(true);
    const { error: err } = await supabase.from('packages').update({ name: name.trim(), price_php: Math.round(p * 100) / 100, features, limits: lim }).eq('id', pkg.id);
    setSaving(false);
    if (err) { setError(errorMessage(err)); return; }
    setNotice(brands > 0 ? `Saved. This applies to the ${brands} brand${brands === 1 ? '' : 's'} on ${name.trim()} right away.` : 'Saved.');
    onSaved();
  }

  return (
    <section className="card p-5" aria-labelledby={`pk-${pkg.id}`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id={`pk-${pkg.id}`} className="font-display text-2xl">{pkg.name} <span className="text-sand-500">{peso(pkg.price_php)}</span></h2>
          <p className="text-xs text-sand-500">{brands} brand{brands === 1 ? '' : 's'} on this package</p>
        </div>
      </div>
      <div className="mt-4 space-y-4">
        {error && <Alert>{error}</Alert>}
        {notice && <Alert kind="success">{notice}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor={`n-${pkg.id}`} className="label">Name</label><input id={`n-${pkg.id}`} className="input" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div><label htmlFor={`p-${pkg.id}`} className="label">Price (₱)</label><input id={`p-${pkg.id}`} type="number" min={0} step="1" className="input" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
        </div>
        <fieldset>
          <legend className="label">Features</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {FEATURES.map((f) => (
              <label key={f.key} className="flex cursor-pointer items-start gap-3 border border-sand-200 px-3 py-2 text-sm">
                <input type="checkbox" className="mt-1 h-4 w-4 accent-black" checked={features[f.key]} onChange={(e) => setFeatures({ ...features, [f.key]: e.target.checked })} />
                <span><span className="font-semibold">{f.label}</span><span className="block text-xs text-sand-500">{f.help}</span></span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend className="label">Limits <span className="font-normal text-sand-500">(leave empty for unlimited)</span></legend>
          <div className="grid gap-3 sm:grid-cols-3">
            {LIMITS.map((l) => (
              <div key={l.key}>
                <label htmlFor={`${pkg.id}-${l.key}`} className="text-xs text-sand-500">{l.label}</label>
                <input id={`${pkg.id}-${l.key}`} type="number" min={0} step={1} className="input" placeholder="Unlimited" value={limits[l.key]} onChange={(e) => setLimits({ ...limits, [l.key]: e.target.value })} />
              </div>
            ))}
          </div>
        </fieldset>
        <button type="button" className="btn-primary" disabled={saving} onClick={save}>{saving && <Spinner />} Save {pkg.name}</button>
      </div>
    </section>
  );
}

export default function OwnerPackages() {
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [p, s] = await Promise.all([
      supabase.from('packages').select('*').order('sort_order'),
      supabase.from('stores').select('package_id'),
    ]);
    const err = p.error ?? s.error;
    if (err) setError(errorMessage(err));
    setPkgs((p.data ?? []) as Pkg[]);
    const c: Record<string, number> = {};
    ((s.data ?? []) as { package_id: string }[]).forEach((x) => { c[x.package_id] = (c[x.package_id] ?? 0) + 1; });
    setCounts(c);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <PageLoader />;

  return (
    <div>
      <PageHeader title="Packages" description="What each plan includes. Changes apply immediately to every brand on that plan. You can also switch single features on or off for one brand, from that brand’s page." />
      {error && <div className="mb-6"><Alert>{error}</Alert></div>}

      <div className="card mb-8 overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left text-sm">
          <thead className="border-b border-sand-200 text-sand-500">
            <tr><th className="px-4 py-3 font-medium">Compare</th>{pkgs.map((p) => <th key={p.id} className="px-4 py-3 font-medium text-black">{p.name}<span className="block text-xs font-normal text-sand-500">{peso(p.price_php)}</span></th>)}</tr>
          </thead>
          <tbody>
            {FEATURES.map((f) => (
              <tr key={f.key} className="border-b border-sand-100">
                <td className="px-4 py-2.5">{f.label}</td>
                {pkgs.map((p) => <td key={p.id} className="px-4 py-2.5">{p.features?.[f.key] ? 'Yes' : <span className="text-sand-500">No</span>}</td>)}
              </tr>
            ))}
            {LIMITS.map((l) => (
              <tr key={l.key} className="border-b border-sand-100 last:border-0">
                <td className="px-4 py-2.5">{l.label}</td>
                {pkgs.map((p) => <td key={p.id} className="px-4 py-2.5">{p.limits?.[l.key] == null ? 'Unlimited' : p.limits[l.key]}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-6">
        {pkgs.map((p) => <PackageCard key={`${p.id}-${p.price_php}-${JSON.stringify(p.features)}-${JSON.stringify(p.limits)}`} pkg={p} brands={counts[p.id] ?? 0} onSaved={load} />)}
      </div>
      <p className="hint mt-6">Prices are labels for your own reference. Billing is handled by you directly; nothing is charged automatically. Content for a switched-off feature stays saved, it just stops being shown on the website.</p>
    </div>
  );
}
