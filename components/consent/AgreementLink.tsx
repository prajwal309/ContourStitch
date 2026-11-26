import { useId, type ReactNode } from 'react';
import {
  agreementPath,
  agreements,
  type Agreement,
} from '@/lib/consent/agreements';

export function AgreementLink({
  type,
  version,
  children,
  className,
}: {
  type: Agreement;
  version?: string;
  children?: ReactNode;
  className?: string;
}) {
  const descriptionId = useId();
  return (
    <a
      className={className ? `agreement-link ${className}` : 'agreement-link'}
      href={agreementPath(type, version)}
      target="_blank"
      rel="noopener noreferrer"
      aria-describedby={descriptionId}
    >
      {children ?? agreements[type].title}
      <span id={descriptionId} hidden>
        Opens in a new tab
      </span>
    </a>
  );
}
