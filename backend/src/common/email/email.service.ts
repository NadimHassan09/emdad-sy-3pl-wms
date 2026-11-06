import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, type Transporter } from 'nodemailer';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transport: Transporter | null = null;
  private fromAddress: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    const port = Number(this.config.get<string>('SMTP_PORT') ?? '587');
    const user = this.config.get<string>('SMTP_USER');
    const pass = this.config.get<string>('SMTP_PASS');
    this.fromAddress = this.config.get<string>('SMTP_FROM') ?? 'noreply@emdad.sy';

    if (host && user && pass) {
      this.transport = createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });
    } else {
      this.logger.warn('SMTP not configured — emails will be logged only. Set SMTP_HOST, SMTP_USER, SMTP_PASS.');
    }
  }

  async send(opts: SendMailOptions): Promise<void> {
    if (!this.transport) {
      this.logger.debug(`[EMAIL STUB] To: ${opts.to} | Subject: ${opts.subject}`);
      return;
    }
    try {
      await this.transport.sendMail({
        from: this.fromAddress,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
      });
    } catch (err) {
      this.logger.error(`Failed to send email to ${opts.to}: ${String(err)}`);
      throw err;
    }
  }
}
