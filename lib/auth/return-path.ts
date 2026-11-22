export function accountReturnPath(value: unknown) {
  if (typeof value !== 'string') return '/my-measurements';
  if (['/family-fit', '/family-fit/invite', '/account'].includes(value))
    return value;
  if (/^\/shop\/[a-z0-9-]{1,64}$/.test(value)) return value;
  if (/^\/family-fit\/[a-z0-9]{25}$/.test(value)) return value;
  return '/my-measurements';
}

export const signInFor = (path: string) =>
  `/sign-in?next=${encodeURIComponent(accountReturnPath(path))}`;
