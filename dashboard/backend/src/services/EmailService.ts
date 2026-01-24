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
const ENV_APP_URL = process.env.APP_URL || 'http://localhost:5173';

// Modern dark email template matching the site design
const emailWrapper = (content: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0f172a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 500px; background-color: #1e293b; border-radius: 16px; border: 1px solid #334155; overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #334155;">
              <div style="display: inline-flex; align-items: center; gap: 8px;">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M13 10V3L4 14h7v7l9-11h-7z" fill="#10b981"/>
                </svg>
                <span style="font-size: 24px; font-weight: 700; color: #ffffff; letter-spacing: -0.5px;">Multibase</span>
              </div>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 24px 32px; background-color: #0f172a; border-top: 1px solid #334155; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #64748b;">
                © ${new Date().getFullYear()} Multibase. All rights reserved.
              </p>
              <p style="margin: 8px 0 0; font-size: 12px; color: #475569;">
                Self-hosted Supabase Management Dashboard
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

const buttonStyle = `
  display: inline-block;
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: #ffffff;
  font-size: 16px;
  font-weight: 600;
  text-decoration: none;
  padding: 14px 32px;
  border-radius: 8px;
  margin: 8px 0;
`;

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
   * Get app URL from DB or fallback to env
   */
  private async getAppUrl(): Promise<string> {
    try {
      const settings = (await prisma.globalSettings.findUnique({ where: { id: 1 } })) as any;
      if (settings?.app_url) {
        return settings.app_url;
      }
    } catch (error) {
      logger.warn('EmailService: Failed to fetch app_url from DB, falling back to env', error);
    }
    return ENV_APP_URL;
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
        text: text || html.replace(/<[^>]*>?/gm, ''),
      });
      logger.info(`EmailService: Sent email to ${to}`);
      return true;
    } catch (error) {
      logger.error(`EmailService: Failed to send email to ${to}`, error);
      return false;
    }
  }

  async sendVerificationEmail(email: string, token: string, username: string) {
    const appUrl = await this.getAppUrl();
    const link = `${appUrl}/verify-email?token=${token}`;
    const subject = '✉️ Verify your Multibase account';

    const content = `
      <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 700; color: #ffffff;">
        Welcome, ${username}! 👋
      </h1>
      <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #94a3b8;">
        Thanks for signing up for Multibase. Please verify your email address to activate your account and get started.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${link}" style="${buttonStyle}">
          Verify Email Address
        </a>
      </div>
      <p style="margin: 24px 0 0; font-size: 14px; color: #64748b;">
        Or copy this link: <a href="${link}" style="color: #10b981; word-break: break-all;">${link}</a>
      </p>
      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #334155;">
        <p style="margin: 0; font-size: 13px; color: #64748b;">
          ⏰ This link expires in <strong style="color: #94a3b8;">24 hours</strong>
        </p>
      </div>
    `;

    return this.sendEmail(email, subject, emailWrapper(content));
  }

  async sendPasswordResetEmail(email: string, token: string) {
    const appUrl = await this.getAppUrl();
    const link = `${appUrl}/reset-password?token=${token}`;
    const subject = '🔐 Reset your Multibase password';

    const content = `
      <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 700; color: #ffffff;">
        Password Reset Request
      </h1>
      <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #94a3b8;">
        We received a request to reset your password. Click the button below to create a new password.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${link}" style="${buttonStyle}">
          Reset Password
        </a>
      </div>
      <p style="margin: 24px 0 0; font-size: 14px; color: #64748b;">
        Or copy this link: <a href="${link}" style="color: #10b981; word-break: break-all;">${link}</a>
      </p>
      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #334155;">
        <p style="margin: 0; font-size: 13px; color: #64748b;">
          ⏰ This link expires in <strong style="color: #94a3b8;">1 hour</strong>
        </p>
        <p style="margin: 8px 0 0; font-size: 13px; color: #64748b;">
          If you didn't request this, you can safely ignore this email.
        </p>
      </div>
    `;

    return this.sendEmail(email, subject, emailWrapper(content));
  }

  async sendWelcomeEmail(email: string, username: string) {
    const appUrl = await this.getAppUrl();
    const subject = '🎉 Welcome to Multibase!';

    const content = `
      <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 700; color: #ffffff;">
        You're all set, ${username}! 🚀
      </h1>
      <p style="margin: 0 0 24px; font-size: 16px; line-height: 1.6; color: #94a3b8;">
        Your email has been verified and your account is now active. Start managing your Supabase instances with ease.
      </p>
      <div style="text-align: center; margin: 32px 0;">
        <a href="${appUrl}/dashboard" style="${buttonStyle}">
          Go to Dashboard
        </a>
      </div>
      <div style="margin-top: 32px; padding: 24px; background-color: #0f172a; border-radius: 12px;">
        <h3 style="margin: 0 0 16px; font-size: 16px; font-weight: 600; color: #ffffff;">
          🎯 Quick Start Guide
        </h3>
        <ul style="margin: 0; padding: 0 0 0 20px; font-size: 14px; line-height: 2; color: #94a3b8;">
          <li>Create your first Supabase instance</li>
          <li>Monitor performance in real-time</li>
          <li>Set up backup schedules</li>
          <li>Configure alert rules</li>
        </ul>
      </div>
    `;

    return this.sendEmail(email, subject, emailWrapper(content));
  }

  async sendDeleteAccountEmail(email: string, username: string) {
    const subject = '👋 Your Multibase account has been deleted';

    const content = `
      <h1 style="margin: 0 0 16px; font-size: 24px; font-weight: 700; color: #ffffff;">
        Goodbye, ${username}
      </h1>
      <p style="margin: 0 0 16px; font-size: 16px; line-height: 1.6; color: #94a3b8;">
        Your Multibase account has been permanently deleted as requested. All your data has been removed from our systems.
      </p>
      <p style="margin: 0; font-size: 16px; line-height: 1.6; color: #94a3b8;">
        We're sorry to see you go. If you ever change your mind, you're always welcome to create a new account.
      </p>
      <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #334155;">
        <p style="margin: 0; font-size: 13px; color: #64748b;">
          Thank you for using Multibase. 💚
        </p>
      </div>
    `;

    return this.sendEmail(email, subject, emailWrapper(content));
  }
}

export default new EmailService();
