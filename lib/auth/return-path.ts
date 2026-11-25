export function accountReturnPath(value: unknown) {
  if (typeof value !== 'string') return '/my-measurements';
  if (
    [
      '/family-fit',
      '/family-fit/invite',
      '/account',
      '/measure',
      '/measure/experimental',
    ].includes(value)
  )
    return value;
  if (/^\/family-fit\/[a-z0-9]{25}$/.test(value)) return value;
  if (/^\/my-measurements\/[a-z0-9]{25}$/.test(value)) return value;
  return '/my-measurements';
}

export const signInFor = (path: string) =>
  `/sign-in?next=${encodeURIComponent(accountReturnPath(path))}`;

export function agreementReviewPath(path: string) {
  return `/agreements/review?next=${encodeURIComponent(accountReturnPath(path))}`;
}
