import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT'),
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  async sendPassPurchaseEmail(
    creatorEmail: string,
    fanAddress: string,
    tierName: string,
    amount: string | number,
  ): Promise<void> {
    try {
      const fromEmail = this.configService.get<string>('FROM_EMAIL', 'noreply@starpass.com');
      const safeFanAddress = this.escapeHtml(fanAddress);
      const safeTierName = this.escapeHtml(tierName);
      const safeAmount = this.escapeHtml(String(amount));

      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>New Pass Purchased!</h2>
          <p>Great news! A fan has just purchased a pass from you.</p>
          <ul>
            <li><strong>Fan Address:</strong> ${safeFanAddress}</li>
            <li><strong>Tier:</strong> ${safeTierName}</li>
            <li><strong>Amount:</strong> ${safeAmount} USDC</li>
          </ul>
          <p>Log in to your dashboard to view more details.</p>
        </div>
      `;

      await this.transporter.sendMail({
        from: fromEmail,
        to: creatorEmail,
        subject: 'New Pass Purchase - StarPass',
        html,
      });

      this.logger.log(`Email notification sent to ${creatorEmail} for pass purchase.`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${creatorEmail}: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
    }
  }

  async sendWaitlistSlotOpenEmail(
    fanEmail: string,
    tierName: string,
    creatorName: string,
  ): Promise<void> {
    try {
      const fromEmail = this.configService.get<string>('FROM_EMAIL', 'noreply@starpass.com');
      const safeTierName = this.escapeHtml(tierName);
      const safeCreatorName = this.escapeHtml(creatorName);

      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>A slot opened up on the waitlist!</h2>
          <p>Great news! A slot has become available for the tier you were waiting for.</p>
          <ul>
            <li><strong>Tier:</strong> ${safeTierName}</li>
            <li><strong>Creator:</strong> ${safeCreatorName}</li>
          </ul>
          <p>Hurry! You have first priority to purchase this pass.</p>
        </div>
      `;

      await this.transporter.sendMail({
        from: fromEmail,
        to: fanEmail,
        subject: 'Waitlist Slot Available - StarPass',
        html,
      });

      this.logger.log(`Email notification sent to ${fanEmail} for waitlist slot opening.`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${fanEmail}: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
    }
  }

  async sendBundlePurchaseEmail(
    creatorEmail: string,
    fanAddress: string,
    tierNames: string,
    totalAmount: string | number,
    passCount: number,
  ): Promise<void> {
    try {
      const fromEmail = this.configService.get<string>('FROM_EMAIL', 'noreply@starpass.com');
      const safeFanAddress = this.escapeHtml(fanAddress);
      const safeTierNames = this.escapeHtml(tierNames);
      const safeTotalAmount = this.escapeHtml(String(totalAmount));
      const safePassCount = this.escapeHtml(String(passCount));

      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>New Bundle Purchased!</h2>
          <p>Great news! A fan has just purchased a bundle of ${safePassCount} passes from you.</p>
          <ul>
            <li><strong>Fan Address:</strong> ${safeFanAddress}</li>
            <li><strong>Tiers:</strong> ${safeTierNames}</li>
            <li><strong>Total Amount:</strong> ${safeTotalAmount} USDC</li>
            <li><strong>Pass Count:</strong> ${safePassCount}</li>
          </ul>
          <p>Log in to your dashboard to view more details.</p>
        </div>
      `;

      await this.transporter.sendMail({
        from: fromEmail,
        to: creatorEmail,
        subject: `New Bundle Purchase (${passCount} passes) - StarPass`,
        html,
      });

      this.logger.log(`Email notification sent to ${creatorEmail} for bundle purchase.`);
    } catch (error) {
      this.logger.error(`Failed to send email to ${creatorEmail}: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
    }
  }

  async sendPassGiftEmail(
    recipientEmail: string,
    tierName: string,
    senderDisplay: string,
  ): Promise<void> {
    try {
      const fromEmail = this.configService.get<string>(
        'FROM_EMAIL',
        'noreply@starpass.com',
      );
      const safeTierName = this.escapeHtml(tierName);
      const safeSenderDisplay = this.escapeHtml(senderDisplay);

      await this.transporter.sendMail({
        from: fromEmail,
        to: recipientEmail,
        subject: 'You received a StarPass gift',
        html: `
          <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>You received a StarPass!</h2>
            <p>${safeSenderDisplay} gifted you a pass.</p>
            <p><strong>Tier:</strong> ${safeTierName}</p>
            <p>Log in to your dashboard to view your new pass.</p>
          </div>
        `,
      });

      this.logger.log('Gift email notification sent.');
    } catch (error) {
      this.logger.error(
        `Failed to send gift email: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  async sendPassRenewalFailedEmail(
    fanEmail: string,
    tierName: string,
    creatorName: string,
    error: string,
  ): Promise<void> {
    try {
      const fromEmail = this.configService.get<string>('FROM_EMAIL', 'noreply@starpass.com');
      const safeTierName = this.escapeHtml(tierName);
      const safeCreatorName = this.escapeHtml(creatorName);
      const safeError = this.escapeHtml(error);

      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Pass Auto-Renewal Failed</h2>
          <p>We're sorry, but your pass auto-renewal failed.</p>
          <ul>
            <li><strong>Tier:</strong> ${safeTierName}</li>
            <li><strong>Creator:</strong> ${safeCreatorName}</li>
            <li><strong>Error:</strong> ${safeError}</li>
          </ul>
          <p>Auto-renewal has been disabled. Please log in to renew your pass manually.</p>
        </div>
      `;

      await this.transporter.sendMail({
        from: fromEmail,
        to: fanEmail,
        subject: 'Pass Auto-Renewal Failed - StarPass',
        html,
      });

      this.logger.log(`Pass renewal failed email sent to ${fanEmail}.`);
    } catch (error) {
      this.logger.error(`Failed to send renewal failed email: ${error instanceof Error ? error.message : 'Unknown error'}`, error instanceof Error ? error.stack : undefined);
    }
  }

  private escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, (character) => {
      const entities: Record<string, string> = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
      };
      return entities[character];
    });
  }
}
