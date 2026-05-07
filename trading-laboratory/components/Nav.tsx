'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav className="border-b bg-background">
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center gap-6">
        <span className="font-semibold text-sm">Trading Laboratory</span>
        <div className="flex gap-1">
          <Link
            href="/"
            className={`px-3 py-1.5 rounded text-sm transition-colors ${
              pathname === '/' ? 'bg-accent font-medium' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Experiments
          </Link>
          <Link
            href="/data-storage"
            className={`px-3 py-1.5 rounded text-sm transition-colors ${
              pathname === '/data-storage' ? 'bg-accent font-medium' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Data Storage
          </Link>
        </div>
      </div>
    </nav>
  );
}
