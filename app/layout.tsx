import type { Metadata } from 'next';
import localFont from 'next/font/local';

import { SessionProvider } from '@/components/SessionProvider';
import { brand } from '@/lib/brand';
import { SiteNavigation } from '@/components/site/SiteNavigation';
import { SiteFooter } from '@/components/site/SiteFooter';

import './globals.css';
import './landing.css';

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

const title = `${brand.name} — ${brand.tagline}`;
const socialImage = {
  url: '/editorial/contourstitch-social.jpg',
  width: 1200,
  height: 630,
  alt: `${brand.name}. ${brand.tagline}`,
};

export const metadata: Metadata = {
  metadataBase: new URL('https://contourstitchv1.vercel.app'),
  applicationName: brand.name,
  icons: { icon: '/logo/logo.png', apple: '/logo/logo.png' },
  title,
  description: brand.description,
  openGraph: {
    type: 'website',
    siteName: brand.name,
    title,
    description: brand.description,
    images: [socialImage],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description: brand.description,
    images: [socialImage],
  },
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

          <SiteNavigation />
          {children}
          <SiteFooter />
        </SessionProvider>
      </body>
    </html>
  );
}
