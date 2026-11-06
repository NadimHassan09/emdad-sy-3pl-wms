import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';

const CODE_TTL_MINUTES = 15;
const SALT_ROUNDS = 10;

@Injectable()
export class PasswordResetService {
  private readonly logger = new Logger(PasswordResetService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {}

  async requestReset(emailAddress: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { email: emailAddress },
      select: { id: true, email: true, fullName: true },
    });

    if (!user) {
      // Don't reveal whether the email exists
      this.logger.debug(`Password reset requested for unknown email: ${emailAddress}`);
      return;
    }

    // Invalidate any existing unused tokens for this user
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);

    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, code, expiresAt },
    });

    const name = user.fullName ?? emailAddress;
    await this.email.send({
      to: user.email,
      subject: 'EMDAD — Password Reset Code',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto">
          <h2 style="color:#1b6b3a">Password Reset</h2>
          <p>Hi ${name},</p>
          <p>Your one-time reset code is:</p>
          <p style="font-size:2rem;font-weight:bold;letter-spacing:.3em;color:#1b6b3a">${code}</p>
          <p>This code expires in ${CODE_TTL_MINUTES} minutes. If you didn't request a password reset, you can safely ignore this email.</p>
          <p style="color:#888;font-size:.85rem">EMDAD Logistics</p>
        </div>`,
    });
  }

  async resetPassword(emailAddress: string, code: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { email: emailAddress },
      select: { id: true },
    });

    if (!user) throw new BadRequestException('Invalid code or email.');

    const token = await this.prisma.passwordResetToken.findFirst({
      where: { userId: user.id, code, used: false },
      orderBy: { createdAt: 'desc' },
    });

    if (!token) throw new BadRequestException('Invalid or expired code.');
    if (token.expiresAt < new Date()) throw new BadRequestException('Code has expired.');

    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash } }),
      this.prisma.passwordResetToken.update({ where: { id: token.id }, data: { used: true } }),
    ]);
  }
}
