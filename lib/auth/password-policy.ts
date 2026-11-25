export const passwordMinLength = 15;
export const passwordMaxLength = 128;
export const passwordMaxCodeUnits = passwordMaxLength * 2;
export const passwordLengthMessage = `Use ${passwordMinLength} to ${passwordMaxLength} characters.`;

export function validPassword(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > passwordMaxCodeUnits)
    return false;
  const length = Array.from(value).length;
  return length >= passwordMinLength && length <= passwordMaxLength;
}
