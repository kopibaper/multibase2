import InstanceManager from './InstanceManager';
import { logger } from '../utils/logger';

export class QueueService {
  constructor(private instanceManager: InstanceManager) {}

  private literal(s: string): string {
    return "'" + s.replace(/'/g, "''") + "'";
  }

  async getStatus(instanceName: string) {
    const result = await this.instanceManager.executeSQL(
      instanceName,
      `SELECT extname, extversion FROM pg_extension WHERE extname = 'pgmq';`
    );
    if (result.error) throw new Error(result.error);
    return { enabled: result.rows.length > 0 };
  }

  async enableExtension(instanceName: string) {
    const result = await this.instanceManager.executeSQL(
      instanceName,
      `CREATE EXTENSION IF NOT EXISTS pgmq;`
    );
    if (result.error) throw new Error(result.error);
    return { success: true };
  }

  async listQueues(instanceName: string) {
    const status = await this.getStatus(instanceName);
    if (!status.enabled) return { queues: [], enabled: false };

    const result = await this.instanceManager.executeSQL(
      instanceName,
      `SELECT queue_name, created_at FROM pgmq.list_queues();`
    );
    if (result.error) throw new Error(result.error);
    return { queues: result.rows, enabled: true };
  }

  async createQueue(instanceName: string, queueName: string) {
    if (!queueName || !/^[a-z][a-z0-9_]*$/.test(queueName)) {
      throw new Error('Queue name must be lowercase alphanumeric with underscores and start with a letter');
    }
    const result = await this.instanceManager.executeSQL(
      instanceName,
      `SELECT pgmq.create(${this.literal(queueName)});`
    );
    if (result.error) throw new Error(result.error);
    return { success: true };
  }

  async dropQueue(instanceName: string, queueName: string) {
    const result = await this.instanceManager.executeSQL(
      instanceName,
      `SELECT pgmq.drop_queue(${this.literal(queueName)});`
    );
    if (result.error) throw new Error(result.error);
    return { success: true };
  }

  async readMessages(instanceName: string, queueName: string, limit = 20, visibilityTimeout = 30) {
    const result = await this.instanceManager.executeSQL(
      instanceName,
      `SELECT * FROM pgmq.read(${this.literal(queueName)}, ${visibilityTimeout}, ${limit});`
    );
    if (result.error) throw new Error(result.error);
    return result.rows;
  }

  async sendMessage(instanceName: string, queueName: string, message: object) {
    const msgJson = this.literal(JSON.stringify(message));
    const result = await this.instanceManager.executeSQL(
      instanceName,
      `SELECT pgmq.send(${this.literal(queueName)}, ${msgJson}::jsonb) AS msg_id;`
    );
    if (result.error) throw new Error(result.error);
    return { msgId: result.rows[0]?.msg_id };
  }

  async purgeQueue(instanceName: string, queueName: string) {
    const result = await this.instanceManager.executeSQL(
      instanceName,
      `SELECT pgmq.purge_queue(${this.literal(queueName)}) AS deleted;`
    );
    if (result.error) throw new Error(result.error);
    return { deleted: result.rows[0]?.deleted ?? 0 };
  }

  async getQueueMetrics(instanceName: string, queueName: string) {
    const result = await this.instanceManager.executeSQL(
      instanceName,
      `SELECT * FROM pgmq.metrics(${this.literal(queueName)});`
    );
    if (result.error) throw new Error(result.error);
    return result.rows[0] || null;
  }
}
