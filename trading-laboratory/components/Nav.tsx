'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav
      style={{ backgroundColor: '#000000', height: 44 }}
      className="flex items-center px-6 sticky top-0 z-50"
    >
      <div className="max-w-[1440px] mx-auto w-full flex items-center gap-8">
        {/* Brand */}
        <Link
          href="/"
          style={{
            color: '#ffffff',
            fontSize: 12,
            fontWeight: 400,
            lineHeight: 1,
            letterSpacing: '-0.12px',
            textDecoration: 'none',
          }}
        >
          Trading Laboratory
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-6">
          <Link
            href="/"
            style={{
              color: pathname === '/' ? '#ffffff' : 'rgba(255,255,255,0.6)',
              fontSize: 12,
              fontWeight: 400,
              lineHeight: 1,
              letterSpacing: '-0.12px',
              textDecoration: 'none',
              transition: 'color 0.15s',
            }}
          >
            Experiments
          </Link>
          <Link
            href="/data-storage"
            style={{
              color: pathname === '/data-storage' ? '#ffffff' : 'rgba(255,255,255,0.6)',
              fontSize: 12,
              fontWeight: 400,
              lineHeight: 1,
              letterSpacing: '-0.12px',
              textDecoration: 'none',
              transition: 'color 0.15s',
            }}
          >
            Data Storage
          </Link>
        </div>

        {/* Right CTA */}
        <div className="ml-auto">
          <Link href="/experiments/new" className="apple-btn-primary" style={{ fontSize: 12, padding: '6px 14px' }}>
            New Experiment
          </Link>
        </div>
      </div>
    </nav>
  );
}
