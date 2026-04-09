import { google } from 'googleapis';
import { createReadStream, statSync } from 'fs';
import path from 'path';
import type { StorageProvider, TestResult } from './StorageProvider';

export interface GoogleDriveConfig {
  clientEmail: string;
  privateKey: string; // PEM key from service account JSON
  folderId: string;   // Google Drive folder ID to upload into
}

export class GoogleDriveProvider implements StorageProvider {
  constructor(private readonly config: GoogleDriveConfig) {}

  private getAuthClient() {
    return new google.auth.JWT({
      email: this.config.clientEmail,
      key: this.config.privateKey.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });
  }

  async upload(localPath: string, remotePath: string): Promise<void> {
    const auth = this.getAuthClient();
    const drive = google.drive({ version: 'v3', auth });
    const fileName = path.basename(remotePath);

    await drive.files.create({
      requestBody: {
        name: fileName,
        parents: [this.config.folderId],
      },
      media: {
        mimeType: 'application/octet-stream',
        body: createReadStream(localPath),
      },
    });
  }

  async testConnection(): Promise<TestResult> {
    try {
      const auth = this.getAuthClient();
      const drive = google.drive({ version: 'v3', auth });
      // List files in the folder to verify access
      await drive.files.list({
        q: `'${this.config.folderId}' in parents`,
        pageSize: 1,
        fields: 'files(id, name)',
      });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }
}
