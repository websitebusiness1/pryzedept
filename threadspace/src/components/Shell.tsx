import { ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '@/auth/AuthProvider';
import Logo from './Logo';

export interface NavItem { to: string; label: string; end?: boolean; group?: string; locked?: boolean }

const mobileLink = ({ isActive }: { isActive: boolean }) =>
  `whitespace-nowrap px-3 py-3 text-sm transition-colors ${isActive ? 'border-b-2 border-white font-semibold text-white' : 'border-b-2 border-transparent text-white/60 hover:text-white'}`;

export default function Shell({ section, nav, switcher, banner }: { section: string; nav: NavItem[]; switcher?: ReactNode; banner?: ReactNode }) {
  const { user, signOut } = useAuth();
  let lastGroup: string | undefined;

  return (
    <div className="min-h-screen bg-sand-50 lg:flex">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col bg-black text-white lg:flex">
        <div className="px-6 pb-4 pt-6"><Logo onDark /></div>
        <p className="px-6 pb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/50">{section}</p>
        {switcher && <div className="px-4 pb-3">{switcher}</div>}
        <nav aria-label={`${section} navigation`} className="flex-1 overflow-y-auto px-3 pb-4">
          {nav.map((n) => {
            const heading = n.group && n.group !== lastGroup ? n.group : null;
            lastGroup = n.group;
            return (
              <div key={n.to}>
                {heading && <p className="px-3 pb-1 pt-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/40">{heading}</p>}
                <NavLink to={n.to} end={n.end}
                  className={({ isActive }) => `flex items-center justify-between px-3 py-2 text-sm transition-colors ${isActive ? 'bg-white font-semibold text-black' : n.locked ? 'text-white/35 hover:bg-white/10 hover:text-white/70' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
                  {n.label}
                  {n.locked && <span className="text-[10px] font-semibold uppercase tracking-widest opacity-80">Locked</span>}
                </NavLink>
              </div>
            );
          })}
        </nav>
        <div className="border-t border-white/15 px-6 py-4 text-sm">
          <p className="truncate text-white/60">{user?.email}</p>
          <button type="button" className="mt-2 text-white underline underline-offset-4 hover:text-white/70" onClick={() => signOut()}>Sign out</button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Mobile top bar */}
        <header className="bg-black text-white lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <Logo onDark size="sm" />
            <div className="flex min-w-0 items-center gap-3">
              {switcher}
              <button type="button" className="shrink-0 text-sm underline underline-offset-4" onClick={() => signOut()}>Sign out</button>
            </div>
          </div>
          <nav aria-label={`${section} navigation`} className="flex overflow-x-auto px-2">
            {nav.map((n) => <NavLink key={n.to} to={n.to} end={n.end} className={mobileLink}>{n.label}{n.locked ? ' 🔒' : ''}</NavLink>)}
          </nav>
        </header>

        <main className="px-4 py-8 sm:px-8 lg:px-10">
          <div className="mx-auto max-w-5xl">
            {banner && <div className="mb-6">{banner}</div>}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
