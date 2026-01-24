import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Load email configuration from environment variables
const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587');
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || '"Multibase" <no-reply@multibase.io>';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

class EmailService {
  /**
   * Get transporter with current settings (DB or Env)
   */
  private async getTransporter(): Promise<{
    transporter: nodemailer.Transporter | null;
    fromEmail: string;
  }> {
    // 1. Try DB Settings
    try {
      // Need a fresh prisma instance or import a singleton. Using new client here should be fine for now,
      // or ideally import the shared one but avoiding circular deps if possible.
      // Since this is a service, let's just use a local instance or import if we had a db file.
      // We'll import PrismaClient.
      // Note: In a real app we might want to cache this configuration to avoid DB hit every email.
      const settings = await prisma.globalSettings.findUnique({ where: { id: 1 } });

      if (settings && settings.smtp_host && settings.smtp_user && settings.smtp_pass) {
        const transporter = nodemailer.createTransport({
          host: settings.smtp_host,
          port: settings.smtp_port || 587,
          secure: settings.smtp_port === 465,
          auth: {
            user: settings.smtp_user,
            pass: settings.smtp_pass,
          },
        });
        const fromEmail = `"${settings.smtp_sender_name || 'Multibase Admin'}" <${settings.smtp_admin_email || settings.smtp_user}>`;
        return { transporter, fromEmail };
      }
    } catch (error) {
      logger.warn('EmailService: Failed to fetch settings from DB, falling back to env', error);
    }

    // 2. Fallback to Env
    if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
      const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465,
        auth: {
          user: SMTP_USER,
          pass: SMTP_PASS,
        },
      });
      return { transporter, fromEmail: SMTP_FROM };
    }

    return { transporter: null, fromEmail: '' };
  }

  /**
   * Verify SMTP connection
   */
  async verifyConnection(): Promise<boolean> {
    const { transporter } = await this.getTransporter();
    if (!transporter) return false;
    try {
      await transporter.verify();
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
    const { transporter, fromEmail } = await this.getTransporter();

    if (!transporter) {
      logger.warn(`EmailService: No SMTP config found. Mock send to ${to} - Subject: ${subject}`);
      return false;
    }

    try {
      await transporter.sendMail({
        from: fromEmail,
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
