import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import localFont from 'next/font/local';

import { SessionProvider } from '@/components/SessionProvider';

import './globals.css';

const editorial = localFont({
  src: [
    {
      path: './fonts/cormorant-garamond.woff2',
      weight: '400 700',
      style: 'normal',
    },
    {
      path: './fonts/cormorant-garamond-italic.woff2',
      weight: '400 700',
      style: 'italic',
    },
  ],
  variable: '--type-cormorant',
  display: 'swap',
});
const inter = localFont({
  src: './fonts/inter.woff2',
  weight: '400 700',
  variable: '--type-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  icons: { icon: '/logo/logo.png', apple: '/logo/logo.png' },
  title: 'ContourStitch — Measure Once. Wear Everywhere.',
  description:
    'Create a reusable fit profile from guided photos or tape measurements and explore coordinated family wedding wear.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${editorial.variable} ${inter.variable}`}
    >
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
              <Link href="/shop">Shop</Link>
              <Link href="/measure">Measure</Link>
              <Link
                href="/my-measurements"
                className="account-nav"
                prefetch={false}
              >
                My Fit Profile
              </Link>
              <Link href="/family-fit" prefetch={false}>
                Family Fit Studio
              </Link>
              <Link href="/account" prefetch={false}>
                My Account
              </Link>
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

            <nav className="footer-links" aria-label="About ContourStitch">
              <Link href="/#how-it-works">How it works</Link>
              <Link href="/founder">Founder</Link>
            </nav>
            <span>Made for your shape. Designed for your privacy.</span>
          </footer>
        </SessionProvider>
      </body>
    </html>
  );
}
