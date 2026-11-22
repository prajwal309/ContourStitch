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
              <Link href="/#how-it-works">How it works</Link>

              <Link href="/founder">Founder</Link>

              <Link
                href="/my-measurements"
                className="account-nav"
                prefetch={false}
              >
                My Measurements
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

            <span>Made for your shape. Designed for your privacy.</span>
          </footer>
        </SessionProvider>
      </body>
    </html>
  );
}
