import { ArgumentMetadata, BadRequestException, Injectable, PipeTransform } from '@nestjs/common';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Permissive replacement for NestJS' built-in ParseUUIDPipe. Accepts any
 * UUID-shaped string (8-4-4-4-12 hex), including the deterministic
 * "nil"-style IDs we use in seed data. Real runtime IDs from
 * `gen_random_uuid()` are v4 and pass either pipe.
 */
@Injectable()
export class ParseUuidLoosePipe implements PipeTransform<string, string> {
  transform(value: string, metadata: ArgumentMetadata): string {
    if (typeof value !== 'string' || !UUID_RE.test(value)) {
      const name = metadata.data ?? 'value';
      throw new BadRequestException(`${name} must be a UUID`);
    }
    return value;
  }
}
