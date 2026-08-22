import { BadRequestException } from '@nestjs/common';

export function throwApiValidation(
  message: string,
  fields?: Record<string, string>,
): never {
  throw new BadRequestException({
    code: 'VALIDATION_ERROR',
    message,
    fields: fields ?? {},
  });
}
