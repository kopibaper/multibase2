import SftpClient from 'ssh2-sftp-client';
import path from 'path';
import type { StorageProvider, TestResult } from './StorageProvider';

export interface SFTPConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  remotePath: string;
}

export class SFTPProvider implements StorageProvider {
  constructor(private readonly config: SFTPConfig) {}

  async upload(localPath: string, remotePath: string): Promise<void> {
    const sftp = new SftpClient();
    try {
      await sftp.connect({
        host: this.config.host,
        port: this.config.port,
        username: this.config.username,
        ...(this.config.privateKey
          ? { privateKey: this.config.privateKey }
          : { password: this.config.password }),
      });

      const dest = path.posix.join(this.config.remotePath, remotePath);
      const destDir = path.posix.dirname(dest);
      await sftp.mkdir(destDir, true);
      await sftp.put(localPath, dest);
    } finally {
      await sftp.end();
    }
  }

  async testConnection(): Promise<TestResult> {
    const sftp = new SftpClient();
    try {
      await sftp.connect({
        host: this.config.host,
        port: this.config.port,
        username: this.config.username,
        ...(this.config.privateKey
          ? { privateKey: this.config.privateKey }
          : { password: this.config.password }),
      });
      await sftp.list(this.config.remotePath).catch(async () => {
        // Try to create if it doesn't exist
        await sftp.mkdir(this.config.remotePath, true);
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      await sftp.end().catch(() => {});
    }
  }
}
