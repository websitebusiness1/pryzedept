import Shell from '@/components/Shell';
import { Alert } from '@/components/ui';
import { useAuth } from '@/auth/AuthProvider';
import { EntitlementsProvider, useEntitlements } from '@/lib/entitlements';

function Inner() {
  const { memberships, activeStore, setActiveStoreId } = useAuth();
  const { can } = useEntitlements();
  const store = activeStore?.store;
  return (
    <Shell
      section={store?.name ?? 'Dashboard'}
      nav={[
        { to: '/dashboard', label: 'Overview', end: true, group: 'Shop' },
        { to: '/dashboard/products', label: 'Products', group: 'Shop' },
        { to: '/dashboard/orders', label: 'Orders', group: 'Shop' },
        { to: '/dashboard/inventory', label: 'Inventory', group: 'Shop' },
        { to: '/dashboard/homepage', label: 'Homepage', group: 'Website' },
        { to: '/dashboard/lookbooks', label: 'Lookbooks', group: 'Website', locked: !can('lookbooks') },
        { to: '/dashboard/videos', label: 'Videos', group: 'Website', locked: !can('videos') },
        { to: '/dashboard/media', label: 'Media library', group: 'Website', locked: !can('media_library') },
        { to: '/dashboard/appearance', label: 'Fonts', group: 'Website', locked: !can('custom_fonts') },
        { to: '/dashboard/preview', label: 'Preview', group: 'Website' },
        { to: '/dashboard/store-settings', label: 'Store settings', group: 'Settings' },
      ]}
      switcher={
        memberships.length > 1 ? (
          <select aria-label="Switch brand" className="input w-full py-1.5 text-black md:w-auto" value={activeStore?.store_id} onChange={(e) => setActiveStoreId(e.target.value)}>
            {memberships.map((m) => <option key={m.store_id} value={m.store_id}>{m.store.name}</option>)}
          </select>
        ) : null
      }
      banner={
        store && store.status !== 'active' ? (
          <Alert kind="error">This brand is {store.status}. Its website content is hidden and changes are disabled. Contact the platform owner to reactivate it.</Alert>
        ) : null
      }
    />
  );
}

export default function DashboardLayout() {
  return <EntitlementsProvider><Inner /></EntitlementsProvider>;
}
