import prisma from '../lib/prisma';
import { promises as fs } from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import archiver from 'archiver';
import extract from 'extract-zip';
import { logger } from '../utils/logger';
import { parseEnvFile } from '../utils/envParser';
import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Readable } from 'stream';

const execAsync = promisify(exec);

export interface BackupOptions {
  type: 'full' | 'instance' | 'database';
  instanceId?: string;
  name?: string;
  createdBy: string;
  destinationIds?: string[];
}

export interface RestoreOptions {
  backupId: string;
  instanceId?: string;
}

export class BackupService {
  private readonly BACKUP_DIR: string;

  constructor(backupDir?: string) {
    this.BACKUP_DIR = backupDir || path.join(process.cwd(), '../backups');
    this.ensureBackupDir();
  }

  /**
   * Ensure backup directory exists
   */
  private async ensureBackupDir(): Promise<void> {
    try {
      await fs.mkdir(this.BACKUP_DIR, { recursive: true });
    } catch (error) {
      logger.error('Error creating backup directory:', error);
    }
  }

  /**
   * Create a backup
   */
  async createBackup(options: BackupOptions) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = options.name || `backup-${options.type}-${timestamp}`;
      const backupPath = path.join(this.BACKUP_DIR, `${backupName}.zip`);

      let filesToBackup: string[] = [];
      let size = 0;

      switch (options.type) {
        case 'full':
          // Backup everything: database, projects, configs
          filesToBackup = await this.getFullBackupFiles();
          break;

        case 'instance':
          if (!options.instanceId) {
            throw new Error('Instance ID required for instance backup');
          }
          // Backup specific instance
          filesToBackup = await this.getInstanceBackupFiles(options.instanceId);
          break;

        case 'database':
          // Backup only database
          filesToBackup = await this.getDatabaseBackupFiles();
          break;

        default:
          throw new Error(`Invalid backup type: ${options.type}`);
      }

      // Create zip archive
      await this.createZipArchive(filesToBackup, backupPath);

      // Get file size
      const stats = await fs.stat(backupPath);
      size = stats.size;

      // Save backup record to database
      const backup = await prisma.backup.create({
        data: {
          name: backupName,
          type: options.type,
          instanceId: options.instanceId,
          size,
          path: backupPath,
          createdBy: options.createdBy,
        },
      });

      logger.info(`Backup created: ${backupName} (${this.formatBytes(size)})`);

      // Async upload to requested external destinations (fire-and-forget)
      if (options.destinationIds && options.destinationIds.length > 0) {
        // Import lazily to avoid circular dependency
        const { ExternalStorageService } = await import('./ExternalStorageService');
        for (const destinationId of options.destinationIds) {
          ExternalStorageService.uploadBackup(backup.path, backup.id, destinationId).catch((err) =>
            logger.error(`Background upload to destination ${destinationId} failed:`, err)
          );
        }
      }

      return backup;
    } catch (error) {
      logger.error('Error creating backup:', error);
      throw error;
    }
  }

  /**
   * Enforce retention policy: delete oldest backups beyond the retention count for a given instanceId+type
   */
  async enforceRetention(instanceId: string, type: string, retention: number): Promise<void> {
    try {
      const backups = await prisma.backup.findMany({
        where: { instanceId, type },
        orderBy: { createdAt: 'desc' },
        select: { id: true, path: true, createdAt: true },
      });

      if (backups.length <= retention) return;

      const toDelete = backups.slice(retention);
      for (const b of toDelete) {
        try {
          await fs.unlink(b.path);
        } catch {
          // file may already be gone
        }
        await prisma.backup.delete({ where: { id: b.id } });
        logger.info(`Retention: deleted old backup ${b.id} (${b.createdAt.toISOString()})`);
      }
    } catch (error) {
      logger.error('Error enforcing retention:', error);
    }
  }
  async listBackups(type?: string) {
    try {
      const where = type ? { type } : {};
      return await prisma.backup.findMany({
        where,
        include: {
          user: {
            select: {
              email: true,
              username: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      logger.error('Error listing backups:', error);
      throw error;
    }
  }

  /**
   * Get backup by ID
   */
  async getBackup(id: string) {
    try {
      return await prisma.backup.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              email: true,
              username: true,
            },
          },
        },
      });
    } catch (error) {
      logger.error('Error fetching backup:', error);
      throw error;
    }
  }

  /**
   * Delete backup
   */
  async deleteBackup(id: string): Promise<void> {
    try {
      const backup = await this.getBackup(id);
      if (!backup) {
        throw new Error('Backup not found');
      }

      // Delete file
      await fs.unlink(backup.path);

      // Delete database record
      await prisma.backup.delete({
        where: { id },
      });

      logger.info(`Backup deleted: ${backup.name}`);
    } catch (error) {
      logger.error('Error deleting backup:', error);
      throw error;
    }
  }

  /**
   * Restore from backup
   */
  async restoreBackup(options: RestoreOptions) {
    try {
      const backup = await this.getBackup(options.backupId);
      if (!backup) {
        throw new Error('Backup not found');
      }

      const extractPath = path.join(this.BACKUP_DIR, `restore-${Date.now()}`);
      await fs.mkdir(extractPath, { recursive: true });

      // Extract backup
      await extract(backup.path, { dir: extractPath });

      // Restore based on type
      switch (backup.type) {
        case 'full':
          await this.restoreFullBackup(extractPath);
          break;

        case 'instance':
          if (!options.instanceId) {
            throw new Error('Instance ID required for instance restore');
          }
          await this.restoreInstanceBackup(extractPath, options.instanceId);
          break;

        case 'database':
          await this.restoreDatabaseBackup(extractPath);
          break;

        default:
          throw new Error(`Invalid backup type: ${backup.type}`);
      }

      // Cleanup
      await fs.rm(extractPath, { recursive: true, force: true });

      logger.info(`Backup restored: ${backup.name}`);

      return { success: true, message: `Backup ${backup.name} restored successfully` };
    } catch (error) {
      logger.error('Error restoring backup:', error);
      throw error;
    }
  }

  /**
   * Get files for full backup
   */
  private async getFullBackupFiles(): Promise<string[]> {
    const files: string[] = [];
    const projectsDir = path.join(process.cwd(), '../../projects');
    const dbPath = path.join(process.cwd(), 'prisma/data/multibase.db');

    // Add database
    files.push(dbPath);

    // Add all projects
    try {
      const projects = await fs.readdir(projectsDir);
      for (const project of projects) {
        const projectPath = path.join(projectsDir, project);
        files.push(projectPath);
      }
    } catch (error) {
      logger.warn('Error reading projects directory:', error);
    }

    return files;
  }

  /**
   * Get files for instance backup
   * For cloud tenants, also dump the project database from the shared cluster.
   * For classic instances, dump the dedicated PostgreSQL container + optionally backup S3 storage.
   */
  private async getInstanceBackupFiles(instanceId: string): Promise<string[]> {
    const projectPath = path.join(process.cwd(), '../../projects', instanceId);
    const files = [projectPath];

    const envPath = path.join(projectPath, '.env');
    try {
      const envContent = await fs.readFile(envPath, 'utf-8');
      const envConfig = parseEnvFile(envPath);

      if (envContent.includes('PROJECT_DB=')) {
        // Cloud tenant → dump project database from shared cluster
        const dbDumpPath = await this.dumpCloudTenantDb(instanceId);
        if (dbDumpPath) files.push(dbDumpPath);
      } else {
        // Classic instance → dump its own dedicated PostgreSQL container
        const dbDumpPath = await this.dumpClassicInstanceDb(instanceId, envConfig);
        if (dbDumpPath) files.push(dbDumpPath);
      }

      // If storage backend is S3, download bucket contents into a temp folder
      if (envConfig['STORAGE_BACKEND'] === 's3') {
        const s3DumpPath = await this.backupS3Storage(instanceId, envConfig);
        if (s3DumpPath) files.push(s3DumpPath);
      }
    } catch {
      // No env file or read error – proceed with files-only backup
    }

    return files;
  }

  /**
   * Dump a classic (dedicated Docker-stack) instance's PostgreSQL database via docker exec pg_dump.
   * Container name convention: <instanceName>-db
   */
  async dumpClassicInstanceDb(
    instanceName: string,
    envConfig: Record<string, string>
  ): Promise<string | null> {
    try {
      const containerName = `${instanceName}-db`;
      const password = envConfig['POSTGRES_PASSWORD'];
      if (!password) {
        logger.warn(`No POSTGRES_PASSWORD found for classic instance ${instanceName}, skipping pg_dump`);
        return null;
      }

      const dumpPath = path.join(this.BACKUP_DIR, `${instanceName}-classic-db-${Date.now()}.sql`);

      const cmd = `docker exec -e PGPASSWORD=${password} ${containerName} pg_dump -U postgres -d postgres --no-owner --no-privileges`;
      const { stdout } = await execAsync(cmd, { maxBuffer: 200 * 1024 * 1024 });

      await fs.writeFile(dumpPath, stdout, 'utf-8');
      logger.info(`Classic instance DB dump created: ${dumpPath} (${this.formatBytes(stdout.length)})`);
      return dumpPath;
    } catch (error) {
      logger.error(`Error dumping classic instance DB for ${instanceName}:`, error);
      return null;
    }
  }

  /**
   * Download all objects from an instance's S3 storage bucket into a temporary directory.
   * Returns the folder path so it can be included in the ZIP.
   */
  async backupS3Storage(
    instanceName: string,
    envConfig: Record<string, string>
  ): Promise<string | null> {
    try {
      const bucket = envConfig['GLOBAL_S3_BUCKET'];
      const accessKeyId = envConfig['AWS_ACCESS_KEY_ID'];
      const secretAccessKey = envConfig['AWS_SECRET_ACCESS_KEY'];
      const region = envConfig['AWS_REGION'] || 'us-east-1';
      const endpoint = envConfig['AWS_S3_ENDPOINT']; // optional custom endpoint (MinIO etc.)

      if (!bucket || !accessKeyId || !secretAccessKey) {
        logger.warn(`Missing S3 credentials for ${instanceName}, skipping S3 storage backup`);
        return null;
      }

      const s3 = new S3Client({
        region,
        credentials: { accessKeyId, secretAccessKey },
        ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
      });

      const dumpDir = path.join(this.BACKUP_DIR, `${instanceName}-s3-storage-${Date.now()}`);
      await fs.mkdir(dumpDir, { recursive: true });

      let continuationToken: string | undefined;
      let totalObjects = 0;
      do {
        const listCmd = new ListObjectsV2Command({
          Bucket: bucket,
          ContinuationToken: continuationToken,
        });
        const listResult = await s3.send(listCmd);

        for (const obj of listResult.Contents || []) {
          if (!obj.Key) continue;
          const getCmd = new GetObjectCommand({ Bucket: bucket, Key: obj.Key });
          const getResult = await s3.send(getCmd);
          const filePath = path.join(dumpDir, obj.Key);
          await fs.mkdir(path.dirname(filePath), { recursive: true });
          await fs.writeFile(
            filePath,
            Buffer.from(await getResult.Body!.transformToByteArray())
          );
          totalObjects++;
        }
        continuationToken = listResult.NextContinuationToken;
      } while (continuationToken);

      logger.info(`S3 storage backup for ${instanceName}: ${totalObjects} objects → ${dumpDir}`);
      return dumpDir;
    } catch (error) {
      logger.error(`Error backing up S3 storage for ${instanceName}:`, error);
      return null;
    }
  }

  /**
   * Restore S3 storage from a backup directory to the bucket.
   */
  async restoreS3Storage(
    instanceName: string,
    s3BackupDir: string,
    envConfig: Record<string, string>
  ): Promise<void> {
    const bucket = envConfig['GLOBAL_S3_BUCKET'];
    const accessKeyId = envConfig['AWS_ACCESS_KEY_ID'];
    const secretAccessKey = envConfig['AWS_SECRET_ACCESS_KEY'];
    const region = envConfig['AWS_REGION'] || 'us-east-1';
    const endpoint = envConfig['AWS_S3_ENDPOINT'];

    if (!bucket || !accessKeyId || !secretAccessKey) {
      logger.warn(`Missing S3 credentials for ${instanceName}, skipping S3 storage restore`);
      return;
    }

    const s3 = new S3Client({
      region,
      credentials: { accessKeyId, secretAccessKey },
      ...(endpoint ? { endpoint, forcePathStyle: true } : {}),
    });

    const uploadDir = async (dir: string, prefix: string) => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const key = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          await uploadDir(fullPath, key);
        } else {
          const content = await fs.readFile(fullPath);
          await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: content }));
        }
      }
    };

    await uploadDir(s3BackupDir, '');
    logger.info(`S3 storage restored for ${instanceName}`);
  }

  /**
   * Dump a cloud tenant's database from the shared PostgreSQL cluster
   */
  async dumpCloudTenantDb(instanceName: string): Promise<string | null> {
    try {
      const sharedEnvPath = path.join(process.cwd(), '../../shared/.env.shared');
      if (!(await fs.stat(sharedEnvPath).catch(() => null))) {
        logger.warn('Shared .env.shared not found for cloud DB dump');
        return null;
      }

      const sharedEnv = parseEnvFile(sharedEnvPath);
      const dbName = `project_${instanceName}`.replace(/-/g, '_');
      const port = sharedEnv.SHARED_PG_PORT || '5432';
      const password = sharedEnv.SHARED_POSTGRES_PASSWORD;

      const dumpPath = path.join(this.BACKUP_DIR, `${instanceName}-db-${Date.now()}.sql`);

      // Use docker exec to pg_dump from the shared database container
      const cmd = `docker exec -e PGPASSWORD=${password} multibase-db pg_dump -U postgres -d ${dbName} --no-owner --no-privileges`;
      const { stdout } = await execAsync(cmd, { maxBuffer: 100 * 1024 * 1024 });

      await fs.writeFile(dumpPath, stdout, 'utf-8');
      logger.info(`Cloud tenant DB dump created: ${dumpPath} (${this.formatBytes(stdout.length)})`);
      return dumpPath;
    } catch (error) {
      logger.error(`Error dumping cloud tenant DB for ${instanceName}:`, error);
      return null;
    }
  }

  /**
   * Restore a classic instance's database into its dedicated PostgreSQL container.
   */
  async restoreClassicInstanceDb(instanceName: string, sqlDumpPath: string): Promise<boolean> {
    try {
      const envPath = path.join(process.cwd(), '../../projects', instanceName, '.env');
      const envConfig = parseEnvFile(envPath);
      const containerName = `${instanceName}-db`;
      const password = envConfig['POSTGRES_PASSWORD'];

      if (!password) {
        logger.warn(`No POSTGRES_PASSWORD found for classic instance ${instanceName}`);
        return false;
      }

      // Terminate connections
      const terminateCmd = `docker exec -e PGPASSWORD=${password} ${containerName} psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='postgres' AND pid<>pg_backend_pid();"`;
      await execAsync(terminateCmd).catch(() => {}); // non-fatal

      const sqlContent = await fs.readFile(sqlDumpPath, 'utf-8');
      const restoreCmd = `docker exec -i -e PGPASSWORD=${password} ${containerName} psql -U postgres -d postgres`;
      await execAsync(restoreCmd, { input: sqlContent } as any);

      logger.info(`Classic instance DB restored for ${instanceName}`);
      return true;
    } catch (error) {
      logger.error(`Error restoring classic instance DB for ${instanceName}:`, error);
      return false;
    }
  }

  /**
   * Restore a cloud tenant's database into the shared PostgreSQL cluster
   */
  async restoreCloudTenantDb(instanceName: string, sqlDumpPath: string): Promise<boolean> {
    try {
      const sharedEnvPath = path.join(process.cwd(), '../../shared/.env.shared');
      const sharedEnv = parseEnvFile(sharedEnvPath);
      const dbName = `project_${instanceName}`.replace(/-/g, '_');
      const password = sharedEnv.SHARED_POSTGRES_PASSWORD;

      // Terminate connections and recreate database
      const dropCmd = `docker exec -e PGPASSWORD=${password} multibase-db psql -U postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${dbName}' AND pid<>pg_backend_pid();" -c "DROP DATABASE IF EXISTS ${dbName};" -c "CREATE DATABASE ${dbName};"`;
      await execAsync(dropCmd);

      // Restore dump via docker exec with stdin
      const sqlContent = await fs.readFile(sqlDumpPath, 'utf-8');
      const restoreCmd = `docker exec -i -e PGPASSWORD=${password} multibase-db psql -U postgres -d ${dbName}`;
      await execAsync(restoreCmd, { input: sqlContent } as any);

      logger.info(`Cloud tenant DB restored: ${dbName}`);
      return true;
    } catch (error) {
      logger.error(`Error restoring cloud tenant DB for ${instanceName}:`, error);
      return false;
    }
  }

  /**
   * Get files for database backup
   */
  private async getDatabaseBackupFiles(): Promise<string[]> {
    const dbPath = path.join(process.cwd(), 'prisma/data/multibase.db');
    return [dbPath];
  }

  /**
   * Create zip archive
   */
  private async createZipArchive(files: string[], outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const output = require('fs').createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => resolve());
      archive.on('error', (err) => reject(err));

      archive.pipe(output);

      for (const file of files) {
        const stats = require('fs').statSync(file);
        if (stats.isDirectory()) {
          archive.directory(file, path.basename(file));
        } else {
          archive.file(file, { name: path.basename(file) });
        }
      }

      archive.finalize();
    });
  }

  /**
   * Restore full backup
   */
  private async restoreFullBackup(extractPath: string): Promise<void> {
    // Copy database
    const dbSrc = path.join(extractPath, 'multibase.db');
    const dbDest = path.join(process.cwd(), 'prisma/data/multibase.db');
    await fs.copyFile(dbSrc, dbDest);

    // Copy projects
    const projectsDest = path.join(process.cwd(), '../../projects');
    const extractedProjects = await fs.readdir(extractPath);

    for (const item of extractedProjects) {
      if (item !== 'multibase.db') {
        const src = path.join(extractPath, item);
        const dest = path.join(projectsDest, item);
        await this.copyRecursive(src, dest);
      }
    }
  }

  /**
   * Restore instance backup (cloud-aware, with S3 storage restore and container restart)
   */
  private async restoreInstanceBackup(extractPath: string, instanceId: string): Promise<void> {
    const projectsDest = path.join(process.cwd(), '../../projects', instanceId);
    const extractedDirs = await fs.readdir(extractPath);

    // Check for any .sql file (cloud or classic DB dump)
    const sqlDump = extractedDirs.find((f) => f.endsWith('.sql'));
    if (sqlDump) {
      const sqlPath = path.join(extractPath, sqlDump);
      if (sqlDump.includes('-classic-db-')) {
        // Classic instance: restore into dedicated DB container
        await this.restoreClassicInstanceDb(instanceId, sqlPath);
      } else {
        // Cloud tenant: restore into shared cluster
        await this.restoreCloudTenantDb(instanceId, sqlPath);
      }
    }

    // Find S3 storage backup directory if present
    const s3BackupDir = extractedDirs.find((f) => f.includes('-s3-storage-') || f === 's3-storage');
    const projectDir = extractedDirs.find(
      (f) => !f.endsWith('.sql') && f !== s3BackupDir
    );

    if (projectDir) {
      const src = path.join(extractPath, projectDir);
      await this.copyRecursive(src, projectsDest);
    }

    // Restore S3 storage if backup exists
    if (s3BackupDir) {
      const envPath = path.join(projectsDest, '.env');
      try {
        const envConfig = parseEnvFile(envPath);
        await this.restoreS3Storage(instanceId, path.join(extractPath, s3BackupDir), envConfig);
      } catch (err) {
        logger.warn(`Could not restore S3 storage for ${instanceId}: ${err}`);
      }
    }

    // Restart instance containers so they pick up the restored data
    const composeFile = path.join(projectsDest, 'docker-compose.yml');
    try {
      if (await fs.stat(composeFile).catch(() => null)) {
        logger.info(`Restarting containers for ${instanceId} after restore...`);
        await execAsync('docker compose stop', { cwd: projectsDest });
        await execAsync('docker compose up -d', { cwd: projectsDest });
        logger.info(`Containers restarted for ${instanceId}`);
      }
    } catch (err) {
      logger.warn(`Could not restart containers for ${instanceId} after restore (non-fatal): ${err}`);
    }
  }

  /**
   * Restore database backup
   */
  private async restoreDatabaseBackup(extractPath: string): Promise<void> {
    const dbSrc = path.join(extractPath, 'multibase.db');
    const dbDest = path.join(process.cwd(), 'prisma/data/multibase.db');
    await fs.copyFile(dbSrc, dbDest);
  }

  /**
   * Copy directory recursively
   */
  private async copyRecursive(src: string, dest: string): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyRecursive(srcPath, destPath);
      } else {
        await fs.copyFile(srcPath, destPath);
      }
    }
  }

  /**
   * Format bytes to human-readable format
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}

export default new BackupService();
