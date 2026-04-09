import { createClient } from 'webdav';
import type { WebDAVClient } from 'webdav';
import { createReadStream } from 'fs';
import * as path from 'path';
import type { StorageProvider, TestResult } from './StorageProvider';

export interface WebDAVConfig {
  url: string;
  username: string;
  password: string;
  remotePath: string;
}

export class WebDAVProvider implements StorageProvider {
  private readonly client: WebDAVClient;

  constructor(private readonly config: WebDAVConfig) {
    this.client = createClient(config.url, {
      username: config.username,
      password: config.password,
    });
  }

  async upload(localPath: string, remotePath: string): Promise<void> {
    const dest = path.posix.join(this.config.remotePath, remotePath);
    const destDir = path.posix.dirname(dest);

    // Ensure remote directory exists
    await this.client.createDirectory(destDir, { recursive: true }).catch(() => {});

    const stream = createReadStream(localPath);
    await this.client.putFileContents(dest, stream, { overwrite: true });
  }

  async testConnection(): Promise<TestResult> {
    try {
      await this.client.getDirectoryContents(this.config.remotePath);
      return { success: true };
    } catch (err: any) {
      // Try to create the directory if it doesn't exist
      try {
        await this.client.createDirectory(this.config.remotePath, { recursive: true });
        return { success: true };
      } catch (err2: any) {
        return { success: false, error: err2.message || err.message };
      }
    }
  }
}
