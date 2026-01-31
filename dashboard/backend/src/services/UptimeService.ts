import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { InstanceManager } from './InstanceManager';

export class UptimeService {
  constructor(
    private prisma: PrismaClient,
    private instanceManager: InstanceManager
  ) {}

  /**
   * Check uptime for all instances
   */
  async checkAllInstances(): Promise<void> {
    try {
      // Get all instances from DB to check status
      const dbInstances = await this.prisma.instance.findMany();

      // Get configs for ports
      const distinctConfigs = await this.instanceManager.listInstanceConfigs();

      logger.debug(`Running uptime checks for ${distinctConfigs.length} instances`);

      // Filter and map
      const checks = distinctConfigs.map(async (config) => {
        const dbInstance = dbInstances.find((i) => i.name === config.name);

        // Skip if explicitly stopped
        if (dbInstance && dbInstance.status === 'stopped') {
          return;
        }

        await this.checkInstance(config);
      });

      await Promise.all(checks);
    } catch (error) {
      logger.error('Error in checkAllInstances:', error);
    }
  }

  /**
   * Check a single instance
   */
  private async checkInstance(instance: { name: string; ports: any }): Promise<void> {
    const start = Date.now();
    let status = 'down';
    let responseTime = 0;

    try {
      // Check Studio port instead of Kong (Kong returns 404 on /health by default)
      // Studio serves the UI on / and should return 200
      const port = instance.ports.studio;
      // Using 5s timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`http://127.0.0.1:${port}/`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        status = 'up';
      }

      responseTime = Date.now() - start;
    } catch (e) {
      // Connection refused or timeout means down
      status = 'down';
      responseTime = 0;
    }

    try {
      await this.prisma.uptimeRecord.create({
        data: {
          instanceId: instance.name, // instanceId references instance.id which is the name
          status,
          responseTime,
        },
      });
    } catch (dbError) {
      logger.error(`Failed to save uptime record for ${instance.name}`, dbError);
    }
  }

  /**
   * Get uptime statistics for an instance
   */
  async getUptimeStats(instanceId: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    try {
      // Verify instance exists to avoid empty stats for non-existent instance
      // We can skip this if we trust the caller, but good for error handling

      const records = await this.prisma.uptimeRecord.findMany({
        where: {
          instanceId,
          timestamp: {
            gte: since,
          },
        },
        orderBy: {
          timestamp: 'asc',
        },
      });

      if (records.length === 0) {
        return {
          uptimeParams: { days },
          uptimePercentage: 0,
          history: [],
        };
      }

      const upCount = records.filter((r: unknown | any) => r.status === 'up').length;
      const totalCount = records.length;
      const uptimePercentage = totalCount > 0 ? (upCount / totalCount) * 100 : 0;

      // Aggregate history for chart (e.g. daily average?)
      // For now return raw records but maybe simplified for chart
      // Requirement: "Small charts similar to CPU/RAM"
      // We can return last 50 checks for a sparkline? Or daily averages?
      // If we check every minute, 30 days is too much data for a small chart.
      // Let's aggregate by day.

      const dailyStats = new Map<string, { total: number; up: number }>();

      records.forEach((r: unknown | any) => {
        const day = r.timestamp.toISOString().split('T')[0];
        const current = dailyStats.get(day) || { total: 0, up: 0 };
        current.total++;
        if (r.status === 'up') current.up++;
        dailyStats.set(day, current);
      });

      const history = Array.from(dailyStats.entries()).map(([date, stats]) => ({
        date,
        uptime: (stats.up / stats.total) * 100,
      }));

      return {
        uptimeParams: { days },
        uptimePercentage, // Overall percentage in period
        history, // Daily percentage
        lastCheck: records[records.length - 1],
      };
    } catch (error) {
      logger.error(`Error getting stats for ${instanceId}:`, error);
      throw error;
    }
  }
}
