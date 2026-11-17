import Shell from '@/components/Shell';

export default function OwnerLayout() {
  return (
    <Shell
      section="Owner"
      nav={[
        { to: '/owner', label: 'Overview', end: true },
        { to: '/owner/stores', label: 'Brands & websites' },
        { to: '/owner/packages', label: 'Packages' },
        { to: '/owner/members', label: 'Members' },
      ]}
    />
  );
}
