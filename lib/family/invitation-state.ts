export function invitationState({
  expiresAt,
  redeemedAt,
  revokedAt,
}: {
  expiresAt: Date;
  redeemedAt: Date | null;
  revokedAt: Date | null;
}) {
  if (revokedAt) return 'Revoked';
  if (redeemedAt) return 'Used';
  return expiresAt.getTime() <= Date.now() ? 'Expired' : 'Active';
}
