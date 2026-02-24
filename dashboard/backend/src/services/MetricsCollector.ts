import { EventEmitter } from 'events';
import { PrismaClient } from '@prisma/client';
import * as os from 'os';
import { SystemMetrics, SHARED_SERVICES } from '../types';
import DockerManager from './DockerManager';
import InstanceManager from './InstanceManager';
import { RedisCache } from './RedisCache';
import { logger } from '../utils/logger';

export class MetricsCollector extends EventEmitter {
  private dockerManager: DockerManager;
  private instanceManager: InstanceManager;
  private redisCache: RedisCache;
  private prisma: PrismaClient;
  private interval: NodeJS.Timeout | null = null;
  private collectionInterval: number;
  private isRunning: boolean = false;

  constructor(
    dockerManager: DockerManager,
    instanceManager: InstanceManager,
    redisCache: RedisCache,
    prisma: PrismaClient,
    collectionInterval: number = 15000
  ) {
    super();
    this.dockerManager = dockerManager;
    this.instanceManager = instanceManager;
    this.redisCache = redisCache;
    this.prisma = prisma;
    this.collectionInterval = collectionInterval;
  }

  /**
   * Start metrics collection
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Metrics collector is already running');
      return;
    }

    logger.info(`Starting metrics collector (interval: ${this.collectionInterval}ms)`);
    this.isRunning = true;

    // Immediate collection
    this.collectAllMetrics();

    // Schedule periodic collection
    this.interval = setInterval(() => {
      this.collectAllMetrics();
    }, this.collectionInterval);
  }

  /**
   * Stop metrics collection
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping metrics collector');

    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }

    this.isRunning = false;
  }

  /**
   * Collect metrics for all instances + shared infrastructure
   */
  private async collectAllMetrics(): Promise<void> {
    try {
      const instances = await this.instanceManager.listInstances();

      let totalCpu = 0;
      let totalMemory = 0;
      let totalDisk = 0;
      let runningCount = 0;

      // Collect shared infrastructure metrics
      const sharedMetrics = await this.collectSharedInfraMetrics();
      if (sharedMetrics) {
        totalCpu += sharedMetrics.cpu;
        totalMemory += sharedMetrics.memory;
        totalDisk += sharedMetrics.disk;
      }

      for (const instance of instances) {
        // Nur Metriken von laufenden Instanzen sammeln
        if (instance.status === 'running' || instance.status === 'healthy') {
          const instanceMetrics = await this.collectInstanceMetrics(instance.name);

          if (instanceMetrics && (instanceMetrics.cpu > 0 || instanceMetrics.memory > 0)) {
            totalCpu += instanceMetrics.cpu;
            totalMemory += instanceMetrics.memory;
            totalDisk += instanceMetrics.disk;
            runningCount++;
          }
        }
      }

      // Store system-wide metrics (including shared infra)
      const hostTotalMemoryMB = Math.round(os.totalmem() / 1024 / 1024);
      const systemMetrics: SystemMetrics = {
        totalCpu: isNaN(totalCpu) ? 0 : totalCpu,
        totalMemory: isNaN(totalMemory) ? 0 : totalMemory,
        totalDisk: isNaN(totalDisk) ? 0 : totalDisk,
        hostTotalMemory: hostTotalMemoryMB,
        instanceCount: instances.length,
        runningCount,
        timestamp: new Date(),
      };

      await this.storeSystemMetrics(systemMetrics);

      // Emit metrics update event
      this.emit('metrics:collected', systemMetrics);
    } catch (error) {
      logger.error('Error collecting all metrics:', error);
    }
  }

  /**
   * Collect metrics for shared infrastructure containers
   */
  async collectSharedInfraMetrics(): Promise<{ cpu: number; memory: number; disk: number } | null> {
    try {
      const sharedContainers = await this.dockerManager.listSharedContainers();
      let sharedCpu = 0;
      let sharedMemory = 0;
      let sharedDisk = 0;

      for (const container of sharedContainers) {
        if (container.State !== 'running') continue;

        const metrics = await this.dockerManager.getContainerStats(container.Id);
        if (metrics) {
          sharedCpu += metrics.cpu;
          sharedMemory += metrics.memory;
          sharedDisk += metrics.diskRead + metrics.diskWrite;

          const containerName = container.Names[0].replace('/', '');
          await this.redisCache.setMetrics('shared-infra', containerName, metrics);
        }
      }

      // Cache aggregate shared metrics
      await this.redisCache.set(
        'shared:metrics',
        JSON.stringify({
          cpu: sharedCpu,
          memory: sharedMemory,
          disk: sharedDisk,
          containerCount: sharedContainers.filter((c) => c.State === 'running').length,
          timestamp: new Date(),
        }),
        60
      );

      return { cpu: sharedCpu, memory: sharedMemory, disk: sharedDisk };
    } catch (error) {
      logger.error('Error collecting shared infra metrics:', error);
      return null;
    }
  }

  /**
   * Collect metrics for a specific instance
   */
  async collectInstanceMetrics(
    instanceName: string
  ): Promise<{ cpu: number; memory: number; disk: number } | null> {
    try {
      const containers = await this.dockerManager.listProjectContainers(instanceName);

      let instanceCpu = 0;
      let instanceMemory = 0;
      let instanceDisk = 0;

      for (const container of containers) {
        const metrics = await this.dockerManager.getContainerStats(container.Id);

        if (metrics) {
          instanceCpu += metrics.cpu;
          instanceMemory += metrics.memory;
          instanceDisk += metrics.diskRead + metrics.diskWrite;

          // Extract service name
          const containerName = container.Names[0].replace('/', '');
          const serviceName = this.extractServiceName(containerName, instanceName);

          // Cache in Redis for real-time access
          await this.redisCache.setMetrics(instanceName, serviceName, metrics);

          // Store in database for historical analysis
          await this.storeMetrics(instanceName, serviceName, metrics);
        }
      }

      return {
        cpu: instanceCpu,
        memory: instanceMemory,
        disk: instanceDisk,
      };
    } catch (error) {
      logger.error(`Error collecting metrics for ${instanceName}:`, error);
      return null;
    }
  }

  /**
   * Store metrics in database
   */
  private async storeMetrics(
    instanceName: string,
    serviceName: string,
    metrics: any
  ): Promise<void> {
    try {
      await this.prisma.instance.upsert({
        where: { id: instanceName },
        update: {
          status: 'running',
          updatedAt: new Date(),
        },
        create: {
          id: instanceName,
          name: instanceName,
          basePort: 0,
          status: 'running',
        },
      });

      await this.prisma.metric.create({
        data: {
          instanceId: instanceName,
          service: serviceName,
          cpu: isNaN(metrics.cpu) ? 0 : metrics.cpu,
          memory: isNaN(metrics.memory) ? 0 : metrics.memory,
          networkRx: isNaN(metrics.networkRx) ? 0 : metrics.networkRx,
          networkTx: isNaN(metrics.networkTx) ? 0 : metrics.networkTx,
          diskRead: isNaN(metrics.diskRead) ? 0 : metrics.diskRead,
          diskWrite: isNaN(metrics.diskWrite) ? 0 : metrics.diskWrite,
          timestamp: metrics.timestamp,
        },
      });
    } catch (error) {
      // If instance doesn't exist in DB, create it
      if ((error as any).code === 'P2003') {
        try {
          await this.prisma.instance.create({
            data: {
              id: instanceName,
              name: instanceName,
              basePort: 0, // Will be updated later
              status: 'running',
            },
          });

          // Retry storing metrics
          await this.storeMetrics(instanceName, serviceName, metrics);
        } catch (createError) {
          logger.error(`Error creating instance ${instanceName} in database:`, createError);
        }
      } else {
        logger.error(`Error storing metrics for ${instanceName}:${serviceName}:`, error);
      }
    }
  }

  /**
   * Store system-wide metrics
   */
  private async storeSystemMetrics(metrics: SystemMetrics): Promise<void> {
    try {
      await this.prisma.systemMetric.create({
        data: {
          totalCpu: metrics.totalCpu,
          totalMemory: metrics.totalMemory,
          totalDisk: metrics.totalDisk,
          instanceCount: metrics.instanceCount,
          runningCount: metrics.runningCount,
          timestamp: metrics.timestamp,
        },
      });
    } catch (error) {
      logger.error('Error storing system metrics:', error);
    }
  }

  /**
   * Get historical metrics for an instance
   */
  async getHistoricalMetrics(
    instanceName: string,
    serviceName?: string,
    since?: Date,
    limit: number = 100
  ): Promise<any[]> {
    try {
      const where: any = {
        instanceId: instanceName,
      };

      if (serviceName) {
        where.service = serviceName;
      }

      if (since) {
        where.timestamp = {
          gte: since,
        };
      }

      const metrics = await this.prisma.metric.findMany({
        where,
        orderBy: {
          timestamp: 'desc',
        },
        take: limit,
      });

      return metrics.reverse(); // Return in chronological order
    } catch (error) {
      logger.error(`Error getting historical metrics for ${instanceName}:`, error);
      return [];
    }
  }

  /**
   * Get system metrics history
   */
  async getSystemMetricsHistory(since?: Date, limit: number = 100): Promise<SystemMetrics[]> {
    try {
      const where: any = {};

      if (since) {
        where.timestamp = {
          gte: since,
        };
      }

      const metrics = await this.prisma.systemMetric.findMany({
        where,
        orderBy: {
          timestamp: 'desc',
        },
        take: limit,
      });

      return metrics.reverse() as unknown as SystemMetrics[];
    } catch (error) {
      logger.error('Error getting system metrics history:', error);
      return [];
    }
  }

  /**
   * Clean up old metrics (older than specified days)
   */
  async cleanupOldMetrics(daysToKeep: number = 7): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      const result = await this.prisma.metric.deleteMany({
        where: {
          timestamp: {
            lt: cutoffDate,
          },
        },
      });

      logger.info(`Cleaned up ${result.count} old metric records`);
      return result.count;
    } catch (error) {
      logger.error('Error cleaning up old metrics:', error);
      return 0;
    }
  }

  /**
   * Extract service name from container name
   */
  private extractServiceName(containerName: string, projectName: string): string {
    if (containerName.includes('realtime-dev.')) {
      return 'realtime';
    }

    const parts = containerName.split('-');
    const projectIndex = parts.indexOf(projectName);

    if (projectIndex !== -1 && projectIndex < parts.length - 1) {
      return parts.slice(projectIndex + 1).join('-');
    }

    return containerName;
  }
}

export default MetricsCollector;
