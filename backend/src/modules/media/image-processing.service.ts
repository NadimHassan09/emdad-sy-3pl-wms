import { BadRequestException, Injectable } from '@nestjs/common';
import sharp from 'sharp';

export type ImageKind = 'product' | 'avatar' | 'company-logo';

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

@Injectable()
export class ImageProcessingService {
  async compress(buffer: Buffer, mimeType: string, kind: ImageKind): Promise<Buffer> {
    if (!ALLOWED_MIME.has(mimeType)) {
      throw new BadRequestException('Only JPEG, PNG, WebP, or GIF images are allowed.');
    }

    const maxEdge = kind === 'avatar' ? 512 : kind === 'company-logo' ? 800 : 1200;
    const quality = kind === 'avatar' ? 82 : 78;

    try {
      return await sharp(buffer, { failOn: 'truncated' })
        .rotate()
        .resize({
          width: maxEdge,
          height: maxEdge,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .webp({ quality, effort: 4 })
        .toBuffer();
    } catch {
      throw new BadRequestException('Could not process this image. Please upload a valid photo.');
    }
  }
}
