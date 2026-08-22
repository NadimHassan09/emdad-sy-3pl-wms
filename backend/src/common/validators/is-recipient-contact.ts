import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';

import { isValidRecipientName, normalizeRecipientContact } from './recipient-contact';

export function IsRecipientName(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isRecipientName',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          if (value == null || value === '') return true;
          if (typeof value !== 'string') return false;
          return isValidRecipientName(value);
        },
        defaultMessage() {
          return 'Name can only contain Arabic or English letters and spaces.';
        },
      },
    });
  };
}

export function IsRecipientPhone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isRecipientPhone',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown, args: ValidationArguments) {
          if (value == null || value === '') return true;
          if (typeof value !== 'string') return false;
          const obj = args.object as { shippingPhoneCountry?: string | null };
          const result = normalizeRecipientContact({
            recipientPhone: value,
            shippingPhoneCountry: obj.shippingPhoneCountry,
          });
          return result.ok;
        },
        defaultMessage(args: ValidationArguments) {
          const obj = args.object as {
            shippingPhoneCountry?: string | null;
            recipientPhone?: string;
          };
          const result = normalizeRecipientContact({
            recipientPhone: typeof args.value === 'string' ? args.value : obj.recipientPhone,
            shippingPhoneCountry: obj.shippingPhoneCountry,
          });
          return result.ok ? 'Please enter a valid phone number.' : result.message;
        },
      },
    });
  };
}
