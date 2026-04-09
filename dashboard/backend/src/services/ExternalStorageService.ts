import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { SFTPProvider, type SFTPConfig } from '../providers/storage/SFTPProvider';
import { S3Provider, type S3Config } from '../providers/storage/S3Provider';
import { GoogleDriveProvider, type GoogleDriveConfig } from '../providers/storage/GoogleDriveProvider';
import { OneDriveProvider, type OneDriveConfig } from '../providers/storage/OneDriveProvider';
import { WebDAVProvider, type WebDAVConfig } from '../providers/storage/WebDAVProvider';
import type { StorageProvider, TestResult } from '../providers/storage/StorageProvider';
import * as path from 'path';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

// ── Encryption helpers ─────────────────────────────────────────────────────────

function getEncryptionKey(): Buffer {
  const raw = process.env.BACKUP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'BACKUP_ENCRYPTION_KEY environment variable is not set. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))"'
    );
  }
  // Accept either raw 32-byte base64 or a passphrase (derive 32 bytes via scrypt)
  const keyBuf = Buffer.from(raw, 'base64');
  if (keyBuf.length === 32) return keyBuf;
  return scryptSync(raw, 'multibase-salt', 32) as Buffer;
}

export function encryptConfig(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Store as base64: iv + authTag + ciphertext
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

export function decryptConfig(ciphertext: string): string {
  const key = getEncryptionKey();
  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.slice(0, IV_LENGTH);
  const authTag = buf.slice(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = buf.slice(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

// ── Provider factory ───────────────────────────────────────────────────────────

function createProvider(type: string, config: Record<string, any>): StorageProvider {
  switch (type) {
    case 'sftp':
      return new SFTPProvider(config as SFTPConfig);
    case 's3':
      return new S3Provider(config as S3Config);
    case 'googledrive':
      return new GoogleDriveProvider(config as GoogleDriveConfig);
    case 'onedrive':
      return new OneDriveProvider(config as OneDriveConfig);
    case 'webdav':
      return new WebDAVProvider(config as WebDAVConfig);
    default:
      throw new Error(`Unknown destination type: ${type}`);
  }
}

// ── ExternalStorageService ─────────────────────────────────────────────────────

class ExternalStorageServiceClass {
  /**
   * Upload a backup file to a configured external destination.
   * Tracks progress in BackupUpload records.
   */
  async uploadBackup(
    backupFilePath: string,
    backupId: string,
    destinationId: string
  ): Promise<void> {
    // Create upload record
    const upload = await prisma.backupUpload.create({
      data: {
        backupId,
        destinationId,
        status: 'pending',
        startedAt: new Date(),
      },
    });

    try {
      await prisma.backupUpload.update({
        where: { id: upload.id },
        data: { status: 'uploading' },
      });

      const destination = await prisma.backupDestination.findUnique({
        where: { id: destinationId },
      });
      if (!destination) throw new Error(`Destination ${destinationId} not found`);
      if (!destination.enabled) throw new Error(`Destination ${destinationId} is disabled`);

      const config = JSON.parse(decryptConfig(destination.config));
      const provider = createProvider(destination.type, config);

      const fileName = path.basename(backupFilePath);
      await provider.upload(backupFilePath, fileName);

      const remotePath = fileName;
      await prisma.backupUpload.update({
        where: { id: upload.id },
        data: { status: 'success', remotePath, completedAt: new Date() },
      });
      logger.info(`Backup ${backupId} uploaded to ${destination.name} (${destination.type})`);
    } catch (error: any) {
      await prisma.backupUpload.update({
        where: { id: upload.id },
        data: { status: 'failed', error: error.message, completedAt: new Date() },
      });
      logger.error(`Upload of backup ${backupId} to ${destinationId} failed:`, error);
      throw error;
    }
  }

  /**
   * Test connectivity to an external destination.
   */
  async testDestination(destinationId: string): Promise<TestResult> {
    const destination = await prisma.backupDestination.findUnique({
      where: { id: destinationId },
    });
    if (!destination) return { success: false, error: 'Destination not found' };

    try {
      const config = JSON.parse(decryptConfig(destination.config));
      const provider = createProvider(destination.type, config);
      return await provider.testConnection();
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  /**
   * Create a new destination (encrypts the config before storing).
   */
  async createDestination(data: {
    name: string;
    type: string;
    config: Record<string, any>;
    enabled?: boolean;
    createdBy: string;
  }) {
    return prisma.backupDestination.create({
      data: {
        name: data.name,
        type: data.type,
        config: encryptConfig(JSON.stringify(data.config)),
        enabled: data.enabled ?? true,
        createdBy: data.createdBy,
      },
    });
  }

  /**
   * Update an existing destination. Config is re-encrypted if provided.
   */
  async updateDestination(
    id: string,
    data: { name?: string; type?: string; config?: Record<string, any>; enabled?: boolean }
  ) {
    return prisma.backupDestination.update({
      where: { id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.config !== undefined && { config: encryptConfig(JSON.stringify(data.config)) }),
        ...(data.enabled !== undefined && { enabled: data.enabled }),
      },
    });
  }

  /**
   * List destinations (config is never returned — only metadata).
   */
  async listDestinations() {
    return prisma.backupDestination.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        type: true,
        enabled: true,
        createdBy: true,
        createdAt: true,
        updatedAt: true,
        // config intentionally omitted
      },
    });
  }

  /**
   * Get a single destination with its decrypted config (for internal use only).
   */
  async getDestinationWithConfig(id: string) {
    const dest = await prisma.backupDestination.findUnique({ where: { id } });
    if (!dest) return null;
    return {
      id: dest.id,
      name: dest.name,
      type: dest.type,
      enabled: dest.enabled,
      config: JSON.parse(decryptConfig(dest.config)),
    };
  }
}

export const ExternalStorageService = new ExternalStorageServiceClass();
