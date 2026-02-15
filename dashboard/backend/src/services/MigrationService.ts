import { Client } from 'pg';
import path from 'path';
import fs from 'fs';
import { PrismaClient } from '@prisma/client';
import { parseEnvFile } from '../utils/envParser';
import { logger } from '../utils/logger';

export interface ExecuteSqlResult {
  success: boolean;
  rowsAffected: number;
  rows?: any[];
  command?: string;
  error?: string;
  duration?: number;
}

export class MigrationService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Validate SQL query for safety
   */
  /**
   * Validate SQL query for safety
   */
  validateSql(sql: string, allowDestructive: boolean = false): { valid: boolean; error?: string } {
    const trimmed = sql.trim().toLowerCase();

    // Block dangerous operations unless explicitly allowed
    if (!allowDestructive) {
      const blocked = ['drop database', 'drop schema', 'truncate', 'drop table'];
      for (const keyword of blocked) {
        if (trimmed.includes(keyword)) {
          return { valid: false, error: `Blocked operation: ${keyword.toUpperCase()}` };
        }
      }
    }

    // Must start with allowed keywords
    const allowed = ['select', 'insert', 'update', 'delete', 'alter', 'create', 'drop', 'with'];
    const startsWithAllowed = allowed.some((kw) => trimmed.startsWith(kw));
    if (!startsWithAllowed) {
      return {
        valid: false,
        error: 'Query must start with SELECT, INSERT, UPDATE, DELETE, ALTER, CREATE, or WITH',
      };
    }

    return { valid: true };
  }

  /**
   * Execute SQL on a specific instance
   */
  async executeSql(
    instanceId: string,
    sql: string,
    userId?: string,
    allowDestructive: boolean = false
  ): Promise<ExecuteSqlResult> {
    // Validate SQL
    const validation = this.validateSql(sql, allowDestructive);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const PROJECTS_PATH = process.env.PROJECTS_PATH || path.join(__dirname, '../../../projects');
    const envPath = path.join(PROJECTS_PATH, instanceId, '.env');

    if (!fs.existsSync(envPath)) {
      throw new Error(`Instance configuration not found at ${envPath}`);
    }

    const envConfig = parseEnvFile(envPath);
    const password = envConfig.POSTGRES_PASSWORD;
    const port = envConfig.POSTGRES_PORT || '5432';

    if (!password) {
      throw new Error('Database password not found in configuration');
    }

    const client = new Client({
      user: 'postgres',
      host: 'localhost',
      database: 'postgres',
      password: password,
      port: parseInt(port, 10),
    });

    try {
      await client.connect();
      const start = Date.now();
      const dbResult = await client.query(sql);
      const duration = Date.now() - start;

      // Log success to audit log if userId is provided
      if (userId) {
        await this.prisma.auditLog.create({
          data: {
            userId,
            action: 'execute_sql',
            resource: `instance/${instanceId}`,
            details: JSON.stringify({
              sql: sql.length > 500 ? sql.substring(0, 500) + '...' : sql,
              rowsAffected: dbResult.rowCount,
              duration,
            }),
            success: true,
          },
        });
      }

      return {
        success: true,
        rowsAffected: dbResult.rowCount || 0,
        rows: dbResult.rows,
        command: dbResult.command,
        duration,
      };
    } catch (error: any) {
      logger.error('Database execution error:', error);

      // Log failure to audit log if userId is provided
      if (userId) {
        await this.prisma.auditLog.create({
          data: {
            userId,
            action: 'execute_sql',
            resource: `instance/${instanceId}`,
            details: JSON.stringify({
              sql: sql.length > 500 ? sql.substring(0, 500) + '...' : sql,
              error: error.message,
            }),
            success: false,
          },
        });
      }

      return {
        success: false,
        rowsAffected: 0,
        error: error.message,
      };
    } finally {
      await client.end();
    }
  }
}
