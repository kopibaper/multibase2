import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

// Load email configuration from environment variables
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || '"Multibase" <no-reply@multibase.io>';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

class EmailService {
  private transporter: nodemailer.Transporter;
  private isConfigured: boolean = false;

  constructor() {
    if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
      this.transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465, // true for 465, false for other ports
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
      });
      this.isConfigured = true;
      logger.info('EmailService: SMTP configured successfully');
    } else {
      // Create a dummy transporter that just logs
      this.transporter = nodemailer.createTransport({
        jsonTransport: true,
      });
      logger.warn('EmailService: SMTP credentials missing in .env. Emails will not be sent.');
    }
  }

  /**
   * Verify SMTP connection
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.isConfigured) return false;
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      logger.error('EmailService: SMTP connection failed', error);
      return false;
    }
  }

  /**
   * Send an email
   */
  async sendEmail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
    if (!this.isConfigured) {
      logger.warn(`EmailService: Mock send to ${to} - Subject: ${subject}`);
      return false;
    }
    try {
      await this.transporter.sendMail({
        from: SMTP_FROM,
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>?/gm, ''), // Simple text fallback
      });
      logger.info(`EmailService: Sent email to ${to}`);
      return true;
    } catch (error) {
      logger.error(`EmailService: Failed to send email to ${to}`, error);
      return false;
    }
  }

  async sendVerificationEmail(email: string, token: string, username: string) {
    const link = `${APP_URL}/verify-email?token=${token}`;
    const subject = 'Verify your Multibase account';
    const html = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
        <h2>Welcome to Multibase, ${username}!</h2>
        <p>Please verify your email address to activate your account.</p>
        <p>
            <a href="${link}" style="background-color: #3ecf8e; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Verify Email</a>
        </p>
        <p>Or click this link: <a href="${link}">${link}</a></p>
        <p>This link expires in 24 hours.</p>
      </div>
    `;
    return this.sendEmail(email, subject, html);
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const link = `${APP_URL}/reset-password?token=${token}`;
    const subject = 'Reset your Multibase password';
    const html = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>You requested to reset your password. Click the button below to proceed.</p>
        <p>
            <a href="${link}" style="background-color: #3ecf8e; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
        </p>
        <p>Or click this link: <a href="${link}">${link}</a></p>
        <p>This link expires in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </div>
    `;
    return this.sendEmail(email, subject, html);
  }

  async sendWelcomeEmail(email: string, username: string) {
    const subject = 'Welcome to Multibase';
    const html = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
        <h2>Welcome aboard, ${username}!</h2>
        <p>We're excited to have you on Multibase. Your account has been verified.</p>
        <p>
            <a href="${APP_URL}/dashboard" style="background-color: #3ecf8e; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Go to Dashboard</a>
        </p>
        <p>Happy building!</p>
      </div>
    `;
    return this.sendEmail(email, subject, html);
  }

  async sendDeleteAccountEmail(email: string, username: string) {
    const subject = 'Your Multibase account has been deleted';
    const html = `
      <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
        <h2>Goodbye, ${username}</h2>
        <p>Your Multibase account has been permanently deleted as requested.</p>
        <p>We're sorry to see you go. If you change your mind, you can always create a new account.</p>
      </div>
    `;
    return this.sendEmail(email, subject, html);
  }
}

export default new EmailService();
