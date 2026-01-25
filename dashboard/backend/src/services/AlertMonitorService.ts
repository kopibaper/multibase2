import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

/**
 * AlertMonitorService - Background service that periodically checks all alert rules
 * and triggers alerts when conditions are met.
 */
export class AlertMonitorService {
  private intervalId: NodeJS.Timeout | null = null;
  private checkIntervalMs: number;
  private isRunning: boolean = false;

  constructor(checkIntervalSeconds: number = 60) {
    this.checkIntervalMs = checkIntervalSeconds * 1000;
  }

  /**
   * Start the background monitoring
   */
  start(): void {
    if (this.intervalId) {
      logger.warn('AlertMonitor already running');
      return;
    }

    logger.info(`AlertMonitor starting, check interval: ${this.checkIntervalMs / 1000}s`);

    // Run immediately on start
    this.runCheck();

    // Then run periodically
    this.intervalId = setInterval(() => {
      this.runCheck();
    }, this.checkIntervalMs);
  }

  /**
   * Stop the background monitoring
   */
  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('AlertMonitor stopped');
    }
  }

  /**
   * Run a check of all alert rules
   */
  private async runCheck(): Promise<void> {
    if (this.isRunning) {
      logger.debug('AlertMonitor check already in progress, skipping');
      return;
    }

    this.isRunning = true;

    try {
      // Get all enabled alert rules
      const rules = await prisma.alertRule.findMany({
        where: { enabled: true },
        include: { instance: true },
      });

      if (rules.length === 0) {
        logger.debug('No enabled alert rules to check');
        return;
      }

      logger.debug(`Checking ${rules.length} alert rules`);

      for (const rule of rules) {
        await this.checkRule(rule);
      }
    } catch (error) {
      logger.error('AlertMonitor check failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Check a single alert rule against current metrics
   */
  private async checkRule(rule: any): Promise<void> {
    try {
      // Get current metrics for the instance
      // In a real implementation, this would fetch from Docker/container metrics
      const metrics = await this.getInstanceMetrics(rule.instanceId);

      if (!metrics) {
        return;
      }

      // Check if the condition is met
      const conditionMet = this.evaluateCondition(rule, metrics);

      if (conditionMet) {
        // Check if there's already an active alert for this rule
        const existingAlert = await prisma.alert.findFirst({
          where: {
            instanceId: rule.instanceId,
            rule: rule.rule,
            status: 'active',
          },
        });

        if (!existingAlert) {
          // Create new alert
          await this.triggerAlert(rule, metrics);
        }
      }
    } catch (error) {
      logger.error(`Error checking rule ${rule.id}:`, error);
    }
  }

  /**
   * Get metrics for an instance (simplified - would connect to Docker in production)
   */
  private async getInstanceMetrics(instanceId: string): Promise<Record<string, number> | null> {
    try {
      // In production, this would fetch real metrics from Docker
      // For now, we'll use a simple simulation based on random values
      // In a real implementation, you'd call dockerManager.getContainerStats()

      // Simulated metrics (replace with real Docker metrics)
      const metrics = {
        cpu: Math.random() * 100, // 0-100%
        memory: Math.random() * 100, // 0-100%
        disk: Math.random() * 100, // 0-100%
        responseTime: Math.random() * 1000, // 0-1000ms
      };

      return metrics;
    } catch (error) {
      logger.error(`Failed to get metrics for instance ${instanceId}:`, error);
      return null;
    }
  }

  /**
   * Evaluate if the alert condition is met
   */
  private evaluateCondition(rule: any, metrics: Record<string, number>): boolean {
    const threshold = rule.threshold || 80;

    switch (rule.rule) {
      case 'high_cpu':
        return metrics.cpu > threshold;
      case 'high_memory':
        return metrics.memory > threshold;
      case 'high_disk':
        return metrics.disk > threshold;
      case 'slow_response':
        return metrics.responseTime > (rule.threshold || 500);
      case 'service_down':
        // Would check container status
        return false;
      default:
        return false;
    }
  }

  /**
   * Trigger an alert and send notifications
   */
  private async triggerAlert(rule: any, metrics: Record<string, number>): Promise<void> {
    try {
      // Create the alert
      const alert = await prisma.alert.create({
        data: {
          instanceId: rule.instanceId,
          name: rule.name,
          rule: rule.rule,
          status: 'active',
          message: this.generateAlertMessage(rule, metrics),
          triggeredAt: new Date(),
          metadata: JSON.stringify(metrics),
        },
      });

      logger.info(`Alert triggered: ${alert.id} - ${rule.name}`);

      // Send notification (webhook)
      await this.sendNotification(alert, rule);
    } catch (error) {
      logger.error(`Failed to trigger alert for rule ${rule.id}:`, error);
    }
  }

  /**
   * Generate an alert message
   */
  private generateAlertMessage(rule: any, metrics: Record<string, number>): string {
    switch (rule.rule) {
      case 'high_cpu':
        return `CPU usage is at ${metrics.cpu.toFixed(1)}% (threshold: ${rule.threshold}%)`;
      case 'high_memory':
        return `Memory usage is at ${metrics.memory.toFixed(1)}% (threshold: ${rule.threshold}%)`;
      case 'high_disk':
        return `Disk usage is at ${metrics.disk.toFixed(1)}% (threshold: ${rule.threshold}%)`;
      case 'slow_response':
        return `Response time is ${metrics.responseTime.toFixed(0)}ms (threshold: ${
          rule.threshold
        }ms)`;
      default:
        return `Alert condition met for ${rule.name}`;
    }
  }

  /**
   * Send notification via configured channels
   */
  private async sendNotification(alert: any, rule: any): Promise<void> {
    try {
      // Log to console (always enabled)
      logger.info(`[ALERT] ${alert.name}: ${alert.message}`);

      // Check notification channels
      let channels: string[] = [];
      try {
        if (rule.notificationChannels) {
          channels = JSON.parse(rule.notificationChannels);
        } else if (alert.notificationChannels) {
          channels = JSON.parse(alert.notificationChannels);
        }
      } catch (e) {
        channels = ['browser']; // Default
      }

      // Email Notification
      if (channels.includes('email')) {
        await this.sendEmail(alert, rule);
      }

      // Webhook Notification
      if (channels.includes('webhook') && rule.webhookUrl) {
        // Implement webhook logic here if needed
      }
    } catch (error) {
      logger.error('Failed to send notification:', error);
    }
  }

  /**
   * Send email notification using Global Settings with modern dark template
   */
  private async sendEmail(alert: any, rule: any): Promise<void> {
    try {
      // Fetch global SMTP settings
      const settings = await prisma.globalSettings.findUnique({ where: { id: 1 } });

      if (!settings || !settings.smtp_host || !settings.smtp_user) {
        logger.warn('Cannot send email alert: SMTP settings incomplete');
        return;
      }

      const transporter = require('nodemailer').createTransport({
        host: settings.smtp_host,
        port: settings.smtp_port || 587,
        secure: settings.smtp_port === 465,
        auth: {
          user: settings.smtp_user,
          pass: settings.smtp_pass,
        },
      });

      const instanceName = rule.instance?.name || rule.instanceId;
      const appUrl = process.env.APP_URL || 'http://localhost:5173';
      const alertTime = new Date().toLocaleString('de-DE', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });

      // Get severity color based on alert type
      const getSeverityInfo = (ruleType: string) => {
        switch (ruleType) {
          case 'high_cpu':
          case 'high_memory':
          case 'high_disk':
            return { color: '#f59e0b', icon: '⚠️', label: 'Warning' };
          case 'service_down':
            return { color: '#ef4444', icon: '🚨', label: 'Critical' };
          default:
            return { color: '#f59e0b', icon: '⚠️', label: 'Alert' };
        }
      };

      const severity = getSeverityInfo(rule.rule);

      const subject = `${severity.icon} [${severity.label}] ${alert.name} - ${instanceName}`;

      const html = `
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
          <!-- Alert Badge -->
          <tr>
            <td style="padding: 24px 32px 0; text-align: center;">
              <div style="display: inline-block; background-color: ${severity.color}20; border: 1px solid ${severity.color}40; border-radius: 20px; padding: 8px 16px;">
                <span style="font-size: 14px; font-weight: 600; color: ${severity.color};">${severity.icon} ${severity.label}</span>
              </div>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 24px 32px 32px;">
              <h1 style="margin: 0 0 8px; font-size: 22px; font-weight: 700; color: #ffffff; text-align: center;">
                ${alert.name}
              </h1>
              <p style="margin: 0 0 24px; font-size: 14px; color: #94a3b8; text-align: center;">
                Alert triggered on <strong style="color: #10b981;">${instanceName}</strong>
              </p>
              
              <!-- Alert Details Box -->
              <div style="background-color: #0f172a; border: 1px solid #334155; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #334155;">
                      <span style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Message</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0 16px;">
                      <span style="font-size: 15px; color: #f1f5f9; line-height: 1.5;">${alert.message}</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 8px 0; border-bottom: 1px solid #334155;">
                      <span style="font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Time</span>
                    </td>
                  </tr>
                  <tr>
                    <td style="padding: 12px 0 0;">
                      <span style="font-size: 15px; color: #f1f5f9;">${alertTime}</span>
                    </td>
                  </tr>
                </table>
              </div>

              <!-- CTA Button -->
              <div style="text-align: center;">
                <a href="${appUrl}/alerts" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; font-size: 16px; font-weight: 600; text-decoration: none; padding: 14px 32px; border-radius: 8px;">
                  View Alerts Dashboard
                </a>
              </div>
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

      await transporter.sendMail({
        from: `"${settings.smtp_sender_name || 'Multibase Monitor'}" <${settings.smtp_user}>`,
        to: settings.smtp_admin_email || settings.smtp_user,
        subject,
        html,
      });

      logger.info(`Email alert sent to ${settings.smtp_admin_email || settings.smtp_user}`);
    } catch (error) {
      logger.error('Failed to send email alert:', error);
    }
  }
}

// Singleton instance
let alertMonitor: AlertMonitorService | null = null;

/**
 * Get or create the AlertMonitor instance
 */
export function getAlertMonitor(): AlertMonitorService {
  if (!alertMonitor) {
    alertMonitor = new AlertMonitorService(60); // Check every 60 seconds
  }
  return alertMonitor;
}

/**
 * Start the AlertMonitor background service
 */
export function startAlertMonitor(): void {
  getAlertMonitor().start();
}

/**
 * Stop the AlertMonitor background service
 */
export function stopAlertMonitor(): void {
  if (alertMonitor) {
    alertMonitor.stop();
  }
}
