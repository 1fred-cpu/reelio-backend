import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import Mail from 'nodemailer/lib/mailer';
import * as path from 'path';
import * as fs from 'fs';
import * as handlebars from 'handlebars';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: Mail;
  private readonly fromEmail: string;
  private readonly frontendUrl: string;

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('MAIL_HOST');
    const port = this.configService.get<number>('MAIL_PORT');
    const user = this.configService.get<string>('MAIL_USER');
    const pass = this.configService.get<string>('MAIL_PASS');
    this.frontendUrl = this.configService.get<string>('APP_URL') || 'reelio://';

    if (!host || !port || !user || !pass) {
      throw new Error(
        'Missing required mail configuration in environment variables.',
      );
    }

    // ✅ Initialize a stable transporter (with connection pool)
    this.transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true, // true for 465, false for 587
      auth: { user, pass },
      pool: true,
      maxConnections: 5,
      maxMessages: 100,
      connectionTimeout: 10000,
      greetingTimeout: 5000,
      socketTimeout: 10000,
      logger: false, // set true for debugging
      debug: false, // set true for SMTP logs
    });

    this.fromEmail = user;

    this.logger.log(`📧 Mail transporter initialized (host: ${host})`);
  }

  /* ============================================================
   * VERIFY CONNECTION ON STARTUP
   * ============================================================ */
  async verifyConnection(): Promise<void> {
    try {
      await this.transporter.verify();
      this.logger.log('✅ Mail server connection verified successfully.');
    } catch (error) {
      this.logger.error('❌ Mail server verification failed:', error);
      throw new InternalServerErrorException('Mail server connection failed');
    }
  }

  /* ============================================================
   * SEND PLAIN EMAIL
   * ============================================================ */
  async sendMail(options: {
    to: string;
    subject: string;
    text?: string;
    html?: string;
  }): Promise<void> {
    try {
      if (!options.to || !options.subject) {
        throw new Error('Missing required email fields: to, subject');
      }

      await this.transporter.sendMail({
        from: this.fromEmail,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      this.logger.log(`📨 Email successfully sent to ${options.to}`);
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${options.to}: ${error.message}`,
      );
      throw new InternalServerErrorException('Email sending failed');
    }
  }

  /* ============================================================
   * SEND TEMPLATE EMAIL (Handlebars)
   * ============================================================ */
  async sendTemplateMail(options: {
    to: string;
    subject: string;
    template: string; // e.g., "verify-email"
    context: Record<string, any>;
  }): Promise<void> {
    try {
      const html = this.compileTemplate(options.template, options.context);
      await this.sendMail({
        to: options.to,
        subject: options.subject,
        html,
      });
    } catch (error) {
      this.logger.error(`Failed to send template email: ${error.message}`);
      throw new InternalServerErrorException('Template email sending failed');
    }
  }

  /* ============================================================
   * SEND EMAIL VERIFICATION LINK
   * ============================================================ */
  async sendEmailVerificationLink(options: {
    to: string;
    name: string;
    token: string;
  }): Promise<void> {
    try {
      const verificationUrl = `${this.frontendUrl}/verify-email?token=${options.token}`;

      await this.sendTemplateMail({
        to: options.to,
        subject: 'Verify your Reelio account',
        template: 'verify-email',
        context: {
          name: options.name,
          verificationUrl,
        },
      });

      this.logger.log(`✅ Verification email sent to ${options.to}`);
    } catch (error) {
      this.logger.error(
        `Failed to send verification email to ${options.to}: ${error.message}`,
      );
      throw new InternalServerErrorException(
        'Failed to send verification email',
      );
    }
  }

  /* ============================================================
   * HANDLEBARS TEMPLATE COMPILER
   * ============================================================ */
  private compileTemplate(
    templateName: string,
    context: Record<string, any>,
  ): string {
    const templatePath = path.join(
      process.cwd(),
      'mail/templates',
      `${templateName}.hbs`,
    );

    if (!fs.existsSync(templatePath)) {
      this.logger.error(`Email template not found: ${templatePath}`);
      throw new InternalServerErrorException(
        `Template "${templateName}" not found`,
      );
    }

    const source = fs.readFileSync(templatePath, 'utf8');
    const compiled = handlebars.compile(source);
    return compiled(context);
  }
}
