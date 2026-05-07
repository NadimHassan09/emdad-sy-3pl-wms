export type SuccessEnvelope<T> = { success: true; data: T };

export function isSuccessEnvelope<T>(value: unknown): value is SuccessEnvelope<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    (value as SuccessEnvelope<T>).success === true &&
    'data' in value
  );
}
