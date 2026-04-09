import { PrismaClient } from '@prisma/client';
import DockerManager from './DockerManager';
import { logger } from '../utils/logger';
import axios from 'axios';

const DRAIN_INTERVAL_MS = 30_000; // deliver every 30s

export class LogDrainService {
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly dockerManager: DockerManager
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.deliverAll().catch((e) => logger.error('LogDrainService error', e)), DRAIN_INTERVAL_MS);
    logger.info('LogDrainService started');
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async deliverAll(): Promise<void> {
    const drains = await this.prisma.logDrain.findMany({ where: { enabled: true } });
    await Promise.allSettled(drains.map((drain) => this.deliverDrain(drain)));
  }

  private async deliverDrain(drain: any): Promise<void> {
    try {
      const services: string[] = JSON.parse(drain.services || '[]');
      const logs: string[] = [];

      // Collect logs from each subscribed service container
      for (const service of services) {
        try {
          const containers = await (this.dockerManager as any).listContainersForService(service).catch(() => []);
          for (const c of containers) {
            const lines = await this.tailContainer(c.Id || c.id, 50);
            logs.push(...lines);
          }
        } catch {
          // service containers not found — skip
        }
      }

      if (logs.length === 0) return;

      const payload = this.formatPayload(logs, drain.format);

      await axios.post(drain.url, payload, {
        timeout: 10_000,
        headers: { 'Content-Type': drain.format === 'json' ? 'application/json' : 'text/plain' },
        validateStatus: (s) => s < 500,
      });

      await this.prisma.logDrain.update({
        where: { id: drain.id },
        data: { lastStatus: 'ok', lastDelivery: new Date() },
      });
    } catch (err: any) {
      logger.warn(`LogDrain delivery failed for ${drain.id}: ${err.message}`);
      await this.prisma.logDrain.update({
        where: { id: drain.id },
        data: { lastStatus: 'error', lastDelivery: new Date() },
      }).catch(() => {});
    }
  }

  private async tailContainer(containerId: string, lines: number): Promise<string[]> {
    try {
      const docker = (this.dockerManager as any).docker;
      const container = docker.getContainer(containerId);
      const logs = await container.logs({ stdout: true, stderr: true, tail: lines, timestamps: true });
      return (logs as Buffer).toString('utf8').split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }

  private formatPayload(logs: string[], format: string): any {
    if (format === 'ndjson') return logs.map((l) => JSON.stringify({ log: l, ts: Date.now() })).join('\n');
    if (format === 'logfmt') return logs.map((l) => `log="${l}" ts=${Date.now()}`).join('\n');
    return { logs, timestamp: new Date().toISOString() };
  }

  async testDeliver(drainId: string): Promise<{ ok: boolean; error?: string }> {
    const drain = await this.prisma.logDrain.findUnique({ where: { id: drainId } });
    if (!drain) return { ok: false, error: 'Drain not found' };
    const payload = this.formatPayload(['[multibase test] Log drain connection test'], drain.format);
    try {
      await axios.post(drain.url, payload, {
        timeout: 10_000,
        headers: { 'Content-Type': drain.format === 'json' ? 'application/json' : 'text/plain' },
        validateStatus: (s) => s < 500,
      });
      await this.prisma.logDrain.update({ where: { id: drainId }, data: { lastStatus: 'ok', lastDelivery: new Date() } });
      return { ok: true };
    } catch (err: any) {
      await this.prisma.logDrain.update({ where: { id: drainId }, data: { lastStatus: 'error' } }).catch(() => {});
      return { ok: false, error: err.message };
    }
  }
}

export default LogDrainService;
