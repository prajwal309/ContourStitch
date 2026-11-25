import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  agreementPath,
  agreements,
  agreementTypes,
} from '@/lib/consent/agreements';
import { documents } from '@/lib/consent/documents';

type Params = { document: string; revision?: string[] };

function findDocument({ document, revision = [] }: Params) {
  const type = agreementTypes.find((key) => agreements[key].slug === document);
  if (!type || revision.length > 1) notFound();
  const agreement = agreements[type];
  const version = revision[0] ?? agreement.version;
  if (!Object.hasOwn(documents[type], version)) notFound();
  return { ...agreement, type, version, sections: documents[type][version] };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}) {
  const { title } = findDocument(await params);
  return {
    title: `${title} | ContourStitch`,
    robots: { index: false, follow: false },
  };
}

export function generateStaticParams() {
  return agreementTypes.flatMap((type) => [
    { document: agreements[type].slug, revision: [] },
    ...Object.keys(documents[type]).map((version) => ({
      document: agreements[type].slug,
      revision: [version],
    })),
  ]);
}

export default async function LegalDocument({
  params,
}: {
  params: Promise<Params>;
}) {
  const { title, type, version, sections } = findDocument(await params);
  return (
    <main id="main" className="flow legal-flow">
      <article className="flow-card legal-document">
        <p className="eyebrow">ContourStitch · One measure. Endless fits.</p>
        <h1>{title}</h1>
        <p className="legal-version">
          Version {version} · Draft pending legal review
        </p>
        {sections.map(({ title, text }) => (
          <section key={title}>
            <h2>{title}</h2>
            <p>{text}</p>
          </section>
        ))}
        <nav aria-label="Other legal documents">
          <ul>
            {agreementTypes
              .filter((key) => key !== type)
              .map((key) => (
                <li key={key}>
                  <Link href={agreementPath(key)}>{agreements[key].title}</Link>
                </li>
              ))}
          </ul>
        </nav>
      </article>
    </main>
  );
}
