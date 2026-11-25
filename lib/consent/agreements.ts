export const agreements = {
  TERMS: { slug: 'terms', title: 'Terms of Service', version: '1' },
  PRIVACY: { slug: 'privacy', title: 'Privacy Policy', version: '1' },
  CAMERA: {
    slug: 'body-measurement-consent',
    title: 'Body Measurement Consent',
    version: '1',
  },
  ACCURACY: {
    slug: 'measurement-accuracy',
    title: 'Measurement Accuracy Disclaimer',
    version: '1',
  },
  IMPROVEMENT: {
    slug: 'measurement-data-improvement',
    title: 'Optional Measurement Data Use',
    version: '1',
  },
} as const;

export type Agreement = keyof typeof agreements;
export const agreementTypes = Object.keys(agreements) as Agreement[];
export const accountAgreements = ['TERMS', 'PRIVACY'] as const;
export const cameraAgreements = ['CAMERA', 'ACCURACY'] as const;
export type ConsentVersions = Partial<Record<Agreement, string>>;
export type ConsentState = Partial<Record<Agreement, ConsentEvent>>;
export type ConsentEvent = {
  type: Agreement;
  status: 'ACCEPTED' | 'DECLINED' | 'REVOKED';
  agreementVersion: string;
  acceptedAt: Date | null;
  revokedAt: Date | null;
};

export function agreementPath(
  type: Agreement,
  version: string = agreements[type].version,
) {
  return `/legal/${agreements[type].slug}/${encodeURIComponent(version)}`;
}

export function currentAcceptance(state: ConsentState, type: Agreement) {
  return (
    state[type]?.status === 'ACCEPTED' &&
    state[type].agreementVersion === agreements[type].version
  );
}

export function missingAgreements(
  state: ConsentState,
  required: readonly Agreement[],
) {
  return required.filter((type) => !currentAcceptance(state, type));
}

export function matchesVersions(
  versions: ConsentVersions,
  required: readonly Agreement[],
) {
  return required.every((type) => versions[type] === agreements[type].version);
}

export function checkedVersions(
  form: FormData,
  types: readonly Agreement[],
): ConsentVersions {
  const versions: ConsentVersions = {};
  for (const type of types) {
    const field = accountAgreements.some((agreement) => agreement === type)
      ? 'ACCOUNT'
      : type;
    const version = form.get(`version-${type}`);
    if (form.get(field) === 'on' && typeof version === 'string')
      versions[type] = version;
  }
  return versions;
}
