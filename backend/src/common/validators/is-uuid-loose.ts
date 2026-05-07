import { ValidateBy, ValidationOptions, buildMessage } from 'class-validator';

/**
 * Permissive UUID validator. Accepts any 8-4-4-4-12 hex UUID-shaped value,
 * including the "nil"-style zero-prefixed UUIDs we use for deterministic seed
 * data (e.g. 00000000-0000-0000-0000-000000000010).
 *
 * class-validator's built-in `@IsUUID()` (default version "all") delegates to
 * validator.js, which only matches versions 1–5 — so seed IDs like
 * 00000000-0000-0000-0000-000000000010 are rejected. Real runtime IDs
 * (`gen_random_uuid()`) are v4 and pass either validator; we use this loose
 * variant so the API is tolerant of any UUID-shaped input.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function IsUuidLoose(validationOptions?: ValidationOptions): PropertyDecorator {
  return ValidateBy(
    {
      name: 'isUuidLoose',
      validator: {
        validate: (value): boolean => typeof value === 'string' && UUID_RE.test(value),
        defaultMessage: buildMessage(
          (eachPrefix) => `${eachPrefix}$property must be a UUID`,
          validationOptions,
        ),
      },
    },
    validationOptions,
  );
}
