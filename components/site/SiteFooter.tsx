import Link from 'next/link';
import { brand } from '@/lib/brand';
import { agreementPath } from '@/lib/consent/agreements';

export function SiteFooter() {
  return (
    <footer className="brand-footer">
      <div className="brand-footer-inner">
        <div>
          <Link href="/" className="brand-wordmark">
            {brand.name}
          </Link>
          <p>{brand.tagline}</p>
        </div>
        <nav aria-label="Footer">
          <Link href="/founder">Founders</Link>
          <Link href="/contact">Contact &amp; feedback</Link>
          <Link href={agreementPath('TERMS')}>Terms of Service</Link>
          <Link href={agreementPath('PRIVACY')}>Privacy Policy</Link>
        </nav>
      </div>
    </footer>
  );
}
