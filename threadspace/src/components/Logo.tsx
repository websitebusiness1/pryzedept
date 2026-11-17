import { Link } from 'react-router-dom';
import { config } from '@/config';

/** The Pryze.dept mark + wordmark. `onDark` uses the white version of the mark. */
export default function Logo({ onDark = false, size = 'md', to = '/' }: { onDark?: boolean; size?: 'sm' | 'md' | 'lg'; to?: string }) {
  const h = { sm: 'h-6', md: 'h-8', lg: 'h-12' }[size];
  const t = { sm: 'text-base', md: 'text-lg', lg: 'text-3xl' }[size];
  return (
    <Link to={to} className="inline-flex items-center gap-2.5" aria-label={`${config.platformName} home`}>
      <img src={onDark ? '/pryze-mark-white.png' : '/pryze-mark-black.png'} alt="" className={`${h} w-auto`} />
      <span className={`font-display ${t} tracking-tight`} style={{ fontWeight: 900 }}>{config.platformName}</span>
    </Link>
  );
}
