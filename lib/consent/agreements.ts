export const agreements = {
  TERMS: { slug: 'terms', title: 'Terms of Service', version: '2' },
  PRIVACY: { slug: 'privacy', title: 'Privacy Policy', version: '5' },
  CAMERA: {
    slug: 'body-measurement-consent',
    title: 'Body Measurement Consent',
    version: '3',
  },
  ACCURACY: {
    slug: 'measurement-accuracy',
    title: 'Measurement Accuracy Disclaimer',
    version: '3',
  },
  BODY_MEASUREMENT: {
    slug: 'body-measurement-policy',
    title: 'Body Measurement Consent & Accuracy Policy',
    version: '1',
  },
  IMPROVEMENT: {
    slug: 'measurement-data-improvement',
    title: 'Optional Measurement Data Use',
    version: '2',
  },
} as const;

export type Agreement = keyof typeof agreements;
export const agreementTypes = Object.keys(agreements) as Agreement[];
export const accountAgreements = ['TERMS', 'PRIVACY'] as const;
export const activeAgreementTypes = agreementTypes.filter(
  (type) => !isArchivedAgreement(type),
);
export const measurementAgreements = ['BODY_MEASUREMENT'] as const;

export function isArchivedAgreement(type: Agreement) {
  return type === 'CAMERA' || type === 'ACCURACY';
}

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

export function validRegistrationVersions(versions: ConsentVersions) {
  return (
    matchesVersions(versions, accountAgreements) &&
    (versions.IMPROVEMENT === undefined ||
      matchesVersions(versions, ['IMPROVEMENT']))
  );
}

export function checkedRegistrationVersions(form: FormData): ConsentVersions {
  return checkedVersions(form, [...accountAgreements, 'IMPROVEMENT']);
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
