import {
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { createReadStream, existsSync } from 'node:fs';
import type { Response } from 'express';
import { UserRole } from '@prisma/client';

import { Public } from '../../../common/auth/public.decorator';
import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { ParseUuidLoosePipe } from '../../../common/pipes/parse-uuid-loose.pipe';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { ImageProcessingService } from '../../media/image-processing.service';
import { MediaStorageService } from '../../media/media-storage.service';
import { ClientUser } from '../auth/client-user.decorator';
import { JwtClientAuthGuard } from '../auth/jwt-client-auth.guard';
import { ClientProductsService } from '../products/client-products.service';

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

function assertUploadedImage(file?: Express.Multer.File): Express.Multer.File {
  if (!file?.buffer?.length) {
    throw new BadRequestException('Please choose an image file to upload.');
  }
  if (!file.mimetype?.startsWith('image/')) {
    throw new BadRequestException('Only image files are allowed.');
  }
  return file;
}

@Public()
@UseGuards(JwtClientAuthGuard)
@Controller('client')
export class ClientMediaController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly images: ImageProcessingService,
    private readonly storage: MediaStorageService,
    private readonly products: ClientProductsService,
  ) {}

  @Post('products/:id/image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_UPLOAD_BYTES },
    }),
  )
  async uploadProductImage(
    @ClientUser() client: ClientPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (client.role === UserRole.client_staff) {
      throw new ForbiddenException('Only client administrators can upload product photos.');
    }
    const product = await this.products.findById(client, id);
    const uploaded = assertUploadedImage(file);
    const compressed = await this.images.compress(uploaded.buffer, uploaded.mimetype, 'product');
    const saved = await this.storage.write('products', client.companyId, compressed);
    await this.storage.remove(product.imagePath ?? null);
    await this.prisma.product.update({
      where: { id },
      data: { imagePath: saved.relativePath },
    });
    return {
      id,
      imageUrl: `/media/products/${id}`,
      byteSize: saved.byteSize,
    };
  }

  @Delete('products/:id/image')
  @HttpCode(204)
  async deleteProductImage(
    @ClientUser() client: ClientPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
  ) {
    if (client.role === UserRole.client_staff) {
      throw new ForbiddenException('Only client administrators can remove product photos.');
    }
    const product = await this.products.findById(client, id);
    await this.storage.remove(product.imagePath ?? null);
    await this.prisma.product.update({
      where: { id },
      data: { imagePath: null },
    });
  }

  /** Cookie-authenticated image for `<img src>` (Bearer is not sent by the browser). */
  @Get('media/products/:id')
  async getProductImage(
    @ClientUser() client: ClientPrincipal,
    @Param('id', ParseUuidLoosePipe) id: string,
    @Res() res: Response,
  ) {
    const product = await this.prisma.product.findFirst({
      where: { id, companyId: client.companyId },
      select: { imagePath: true },
    });
    if (!product?.imagePath) throw new NotFoundException('Product image not found.');
    const absolute = this.storage.absolutePath(product.imagePath);
    if (!existsSync(absolute)) throw new NotFoundException('Product image not found.');
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    createReadStream(absolute).pipe(res);
  }
}
