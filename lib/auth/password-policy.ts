export const multiFactorAuthenticationRequired = false;
export const passwordMinLength = multiFactorAuthenticationRequired ? 8 : 15;
export const passwordMaxLength = 128;
export const passwordMaxCodeUnits = passwordMaxLength * 2;
export const passwordLengthMessage = `Use at least ${passwordMinLength} characters.`;
export const passwordMaxLengthMessage = `Use no more than ${passwordMaxLength} characters.`;

export function passwordValidationMessage(value: unknown) {
  if (typeof value !== 'string') return passwordLengthMessage;
  if (value.length > passwordMaxCodeUnits) return passwordMaxLengthMessage;
  const length = Array.from(value).length;
  if (length < passwordMinLength) return passwordLengthMessage;
  if (length > passwordMaxLength) return passwordMaxLengthMessage;
  return '';
}

export function validPassword(value: unknown): value is string {
  return passwordValidationMessage(value) === '';
}
