import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { InstanceManager } from './InstanceManager';

export class UptimeService {
  constructor(
    private prisma: PrismaClient,
    private instanceManager: InstanceManager
  ) {}

  private async ensureInstanceRecord(
    instanceName: string
  ): Promise<{ id: string; status: string }> {
    const config = (await this.instanceManager.listInstanceConfigs()).find(
      (instance) => instance.name === instanceName
    );

    const basePort = config?.ports?.gateway_port || config?.ports?.kong_http || config?.ports?.studio || 0;

    const instance = await this.prisma.instance.upsert({
      where: { id: instanceName },
      update: {
        name: instanceName,
        updatedAt: new Date(),
      },
      create: {
        id: instanceName,
        name: instanceName,
        basePort,
        status: 'running',
      },
      select: {
        id: true,
        status: true,
      },
    });

    return instance;
  }

  /**
   * Check uptime for all instances
   */
  async checkAllInstances(): Promise<void> {
    try {
      // Get configs for ports
      const distinctConfigs = await this.instanceManager.listInstanceConfigs();

      logger.debug(`Running uptime checks for ${distinctConfigs.length} instances`);

      // Filter and map
      const checks = distinctConfigs.map(async (config) => {
        const dbInstance = await this.ensureInstanceRecord(config.name);

        // Skip if explicitly stopped
        if (dbInstance.status === 'stopped') {
          return;
        }

        await this.checkInstance(config, dbInstance.id);
      });

      await Promise.all(checks);
    } catch (error) {
      logger.error('Error in checkAllInstances:', error);
    }
  }

  /**
   * Check a single instance
   */
  private async checkInstance(instance: { name: string; ports: any }, dbId: string): Promise<void> {
    const start = Date.now();
    let status = 'down';
    let responseTime = 0;

    try {
      // Port priority:
      //   Cloud stack:   gateway_port (Nginx gateway, replaces Kong) → /rest/v1/
      //   Classic stack: studio port → /
      //   Fallback:      kong_http (legacy field name) → /rest/v1/
      const gatewayPort = instance.ports.gateway_port || instance.ports.kong_http;
      const studioPort = instance.ports.studio;

      // Prefer gateway (cloud) if available; fall back to studio (classic)
      const port = gatewayPort || studioPort;
      const healthPath = studioPort && !gatewayPort ? '/' : '/rest/v1/';

      if (!port) {
        logger.warn(`UptimeService: no valid port found for instance "${instance.name}", skipping check`);
        return;
      }

      // Using 5s timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`http://localhost:${port}${healthPath}`, {
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok || response.status === 401) {
        // 401 means the gateway is up but requires auth — still counts as "up"
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
          instanceId: dbId,
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
  async getUptimeStats(instanceName: string, days: number = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    try {
      // Find instance by name to get its ID
      let instance = await this.prisma.instance.findUnique({ where: { name: instanceName } });

      if (!instance) {
        const ensured = await this.ensureInstanceRecord(instanceName);
        instance = await this.prisma.instance.findUnique({ where: { id: ensured.id } });
      }

      if (!instance) {
        throw new Error(`Instance not found: ${instanceName}`);
      }

      const records = await this.prisma.uptimeRecord.findMany({
        where: {
          instanceId: instance.id,
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

      // Calculate hours up per day (checks every minute = 60 checks/hour, 1440/day max)
      // If we have N checks and X are up, hours up = (X / N) * 24
      const history = Array.from(dailyStats.entries()).map(([date, stats]) => ({
        date,
        hours: Math.round((stats.up / stats.total) * 24 * 10) / 10, // 1 decimal precision
      }));

      return {
        uptimeParams: { days },
        uptimePercentage, // Overall percentage in period
        history, // Daily percentage
        lastCheck: records[records.length - 1],
      };
    } catch (error) {
      logger.error(`Error getting stats for ${instanceName}:`, error);
      throw error;
    }
  }
}
