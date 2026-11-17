import { ReactNode, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { FEATURES, FeatureKey, peso, useEntitlements } from '@/lib/entitlements';
import { config } from '@/config';
import { PageHeader, PageLoader } from './ui';

interface Pkg { id: string; name: string; price_php: number; features: Partial<Record<FeatureKey, boolean>> }

export function UpgradeNotice({ feature, title }: { feature: FeatureKey; title: string }) {
  const { ent } = useEntitlements();
  const [pkgs, setPkgs] = useState<Pkg[]>([]);
  useEffect(() => { supabase.from('packages').select('id, name, price_php, features').order('sort_order').then(({ data }) => setPkgs((data ?? []) as Pkg[])); }, []);
  const meta = FEATURES.find((f) => f.key === feature);
  const includedIn = pkgs.filter((p) => p.features?.[feature]);
  const mail = config.contactEmail ? `mailto:${config.contactEmail}?subject=${encodeURIComponent(`Upgrade request: ${meta?.label ?? title}`)}` : '';

  return (
    <div>
      <PageHeader title={title} />
      <div className="card max-w-2xl p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sand-500">Not in your package</p>
        <h2 className="font-display mt-2 text-3xl">{meta?.label ?? title} isn’t included in {ent ? ent.package.name : 'your package'}.</h2>
        <p className="mt-3 text-sm text-sand-500">{meta?.help}.</p>
        {includedIn.length > 0 && (
          <p className="mt-5 text-sm">
            Included in: {includedIn.map((p, i) => <span key={p.id}>{i > 0 && ' and '}<strong>{p.name}</strong> ({peso(p.price_php)})</span>)}.
          </p>
        )}
        {ent && <p className="mt-2 text-sm text-sand-500">Your current package: {ent.package.name} ({peso(ent.package.price_php)}).</p>}
        <div className="mt-6">
          {mail ? <a href={mail} className="btn-primary">Ask Pryze.dept to upgrade</a> : <p className="text-sm text-sand-500">Contact the Pryze.dept team to upgrade.</p>}
        </div>
      </div>
    </div>
  );
}

/** Shows the page only if the brand's package (or an owner override) includes the feature. The database enforces it too. */
export default function FeatureGate({ feature, title, children }: { feature: FeatureKey; title: string; children: ReactNode }) {
  const { loading, can } = useEntitlements();
  if (loading) return <PageLoader />;
  return can(feature) ? <>{children}</> : <UpgradeNotice feature={feature} title={title} />;
}

/** "12 of 30 used" style note, or nothing if the limit is unlimited. */
export function UsageNote({ used, limit, noun }: { used: number; limit: number | null; noun: string }) {
  if (limit == null) return null;
  const full = used >= limit;
  return <span className={full ? 'font-semibold text-red-800' : ''}>{used} of {limit} {noun} used{full ? ' · limit reached' : ''}</span>;
}
