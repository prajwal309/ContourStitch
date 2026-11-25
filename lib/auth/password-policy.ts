export const passwordMinLength = 8;
export const passwordMaxLength = 128;
export const passwordMaxCodeUnits = passwordMaxLength * 2;
export const passwordLengthMessage = `Use at least ${passwordMinLength} characters, including one special character.`;
export const passwordMaxLengthMessage = `Use no more than ${passwordMaxLength} characters.`;
const specialCharacterPattern = /[\p{P}\p{S}]/u;

export function passwordValidationMessage(value: unknown) {
  if (typeof value !== 'string') return passwordLengthMessage;
  if (value.length > passwordMaxCodeUnits) return passwordMaxLengthMessage;
  const length = Array.from(value).length;
  if (length > passwordMaxLength) return passwordMaxLengthMessage;
  if (length < passwordMinLength || !specialCharacterPattern.test(value))
    return passwordLengthMessage;
  return '';
}

export function validPassword(value: unknown): value is string {
  return passwordValidationMessage(value) === '';
}

export function validPasswordForVerification(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= passwordMaxCodeUnits &&
    Array.from(value).length <= passwordMaxLength
  );
}
