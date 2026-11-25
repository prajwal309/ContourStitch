'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Menu } from 'lucide-react';
import { useRef } from 'react';
import { brand } from '@/lib/brand';

const links = [
  { href: '/founder', label: 'Founders' },
  { href: '/#how-it-works', label: 'How It Works' },
  { href: '/my-measurements', label: 'My Fit Profile' },
  { href: '/family-fit', label: 'Family Fit Studio' },
  { href: '/sign-in?next=%2Faccount', label: 'Sign In' },
];

export function SiteNavigation() {
  const menu = useRef<HTMLDetailsElement>(null);

  function closeMenu() {
    if (menu.current) menu.current.open = false;
  }

  return (
    <header className="brand-header">
      <div className="brand-header-inner">
        <Link href="/" className="brand-wordmark" onClick={closeMenu}>
          <Image src="/logo/logo.png" alt="" width={30} height={36} />
          {brand.name}
        </Link>
        <nav className="brand-nav-desktop" aria-label="Main navigation">
          {links.map(({ href, label }) => (
            <Link key={href} href={href} prefetch={false}>
              {label}
            </Link>
          ))}
        </nav>
        <div className="brand-header-actions">
          <Link
            href="/measure"
            className="brand-header-cta"
            onClick={closeMenu}
          >
            Start Measuring <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
          <details
            className="brand-mobile-menu"
            ref={menu}
            onKeyDown={(event) => {
              if (event.key === 'Escape' && menu.current?.open) {
                closeMenu();
                menu.current.querySelector('summary')?.focus();
              }
            }}
          >
            <summary>
              <Menu size={21} aria-hidden="true" />
              <span className="sr-only">Navigation menu</span>
            </summary>
            <nav aria-label="Mobile navigation">
              {links.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  prefetch={false}
                  onClick={closeMenu}
                >
                  {label}
                </Link>
              ))}
            </nav>
          </details>
        </div>
      </div>
    </header>
  );
}
