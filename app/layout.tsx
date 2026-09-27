import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { LockKeyhole } from 'lucide-react';

import { SessionProvider } from '@/components/SessionProvider';

import './globals.css';

export const metadata: Metadata = {
  icons: { icon: '/logo/logo.png', apple: '/logo/logo.png' },
  title: 'ContourStitch — A better starting point for fit',
  description:
    'Private, guided body measurement estimates from two photographs. Review, correct and save on your device.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SessionProvider>
          <a className="skip" href="#main">
            Skip to content
          </a>

          <header className="site-header">
            <Link href="/" className="brand">
              <Image
                src="/logo/logo.png"
                alt=""
                width={48}
                height={48}
                className="brand-logo"
              />
              ContourStitch
              <span className="beta">BETA</span>
            </Link>

            <nav aria-label="Main navigation">
              <Link href="/#how-it-works">How it works</Link>

              <Link href="/founder">
                Founder
              </Link>

              <span className="private-label">
                <LockKeyhole size={14} />
                Private by design
              </span>
            </nav>
          </header>

          {children}

          <footer>
            <Link href="/" className="brand small">
              <Image
                src="/logo/logo.png"
                alt=""
                width={36}
                height={36}
                className="brand-logo"
              />
              ContourStitch
            </Link>

            <span>
              Made for your shape. Designed for your privacy.
            </span>

            <span>
              Estimates, thoughtfully made.
            </span>
          </footer>
        </SessionProvider>
      </body>
    </html>
  );
}