import InstanceManager from './InstanceManager';
import { logger } from '../utils/logger';

export interface CronJobConfig {
  name: string;
  schedule: string;
  command: string;
}

export class CronService {
  constructor(private instanceManager: InstanceManager) {}

  private literal(s: string): string {
    return "'" + s.replace(/'/g, "''") + "'";
  }

  async getStatus(instanceName: string) {
    const result = await this.instanceManager.executeSQL(
      instanceName,
      `SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_cron';`
    );
    if (result.error) throw new Error(result.error);
    return { enabled: result.rows.length > 0, extension: result.rows[0] || null };
  }

  async listJobs(instanceName: string) {
    const status = await this.getStatus(instanceName);
    if (!status.enabled) return { jobs: [], enabled: false };

    const result = await this.instanceManager.executeSQL(
      instanceName,
      `SELECT jobid, jobname, schedule, command, active, username
       FROM cron.job
       ORDER BY jobid;`
    );
    if (result.error) throw new Error(result.error);
    return { jobs: result.rows, enabled: true };
  }

  async createJob(instanceName: string, config: CronJobConfig) {
    const { name, schedule, command } = config;

    if (!name || !schedule || !command) {
      throw new Error('name, schedule, and command are required');
    }

    const result = await this.instanceManager.executeSQL(
      instanceName,
      `SELECT cron.schedule(${this.literal(name)}, ${this.literal(schedule)}, ${this.literal(command)}) AS jobid;`
    );
    if (result.error) throw new Error(result.error);
    return { jobid: result.rows[0]?.jobid };
  }

  async deleteJob(instanceName: string, jobId: number) {
    const result = await this.instanceManager.executeSQL(
      instanceName,
      `SELECT cron.unschedule(${jobId}::bigint) AS success;`
    );
    if (result.error) throw new Error(result.error);
    return { success: true };
  }

  async toggleJob(instanceName: string, jobId: number, active: boolean) {
    const result = await this.instanceManager.executeSQL(
      instanceName,
      `UPDATE cron.job SET active = ${active} WHERE jobid = ${jobId} RETURNING *;`
    );
    if (result.error) throw new Error(result.error);
    if (result.rows.length === 0) throw new Error('Job not found');
    return result.rows[0];
  }

  async runJobNow(instanceName: string, jobId: number) {
    // Fetch the command and execute it immediately
    const getResult = await this.instanceManager.executeSQL(
      instanceName,
      `SELECT command FROM cron.job WHERE jobid = ${jobId};`
    );
    if (getResult.error) throw new Error(getResult.error);
    if (getResult.rows.length === 0) throw new Error('Job not found');

    const { command } = getResult.rows[0];
    const execResult = await this.instanceManager.executeSQL(instanceName, command);
    if (execResult.error) throw new Error(execResult.error);
    return { success: true, rows: execResult.rows };
  }

  async getJobRuns(instanceName: string, jobId: number, limit = 20) {
    const result = await this.instanceManager.executeSQL(
      instanceName,
      `SELECT runid, jobid, job_pid, database, username, command, status, return_message, start_time, end_time
       FROM cron.job_run_details
       WHERE jobid = ${jobId}
       ORDER BY start_time DESC
       LIMIT ${limit};`
    );
    if (result.error) throw new Error(result.error);
    return result.rows;
  }
}
