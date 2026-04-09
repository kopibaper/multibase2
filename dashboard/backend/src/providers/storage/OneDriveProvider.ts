import axios from 'axios';
import { createReadStream, statSync } from 'fs';
import * as path from 'path';
import type { StorageProvider, TestResult } from './StorageProvider';

export interface OneDriveConfig {
  tenantId: string;
  clientId: string;
  clientSecret: string;
  driveId?: string;    // SharePoint drive ID — leave empty for personal OneDrive
  folderPath: string;  // e.g. "/Backups/multibase"
}

export class OneDriveProvider implements StorageProvider {
  constructor(private readonly config: OneDriveConfig) {}

  private async getAccessToken(): Promise<string> {
    const url = `https://login.microsoftonline.com/${this.config.tenantId}/oauth2/v2.0/token`;
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
    });

    const response = await axios.post(url, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return response.data.access_token;
  }

  private get graphBase(): string {
    return this.config.driveId
      ? `https://graph.microsoft.com/v1.0/drives/${this.config.driveId}`
      : 'https://graph.microsoft.com/v1.0/me/drive';
  }

  async upload(localPath: string, remotePath: string): Promise<void> {
    const token = await this.getAccessToken();
    const fileName = path.basename(remotePath);
    const destPath = `${this.config.folderPath.replace(/\/$/, '')}/${fileName}`;
    const fileSize = statSync(localPath).size;

    // Use upload session for large files (>= 4 MB), simple upload otherwise
    if (fileSize < 4 * 1024 * 1024) {
      const uploadUrl = `${this.graphBase}/root:${encodeURIComponent(destPath)}:/content`;
      const fileBuffer = require('fs').readFileSync(localPath);
      await axios.put(uploadUrl, fileBuffer, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/octet-stream',
        },
      });
    } else {
      // Create upload session
      const sessionUrl = `${this.graphBase}/root:${encodeURIComponent(destPath)}:/createUploadSession`;
      const sessionResp = await axios.post(
        sessionUrl,
        { item: { '@microsoft.graph.conflictBehavior': 'replace' } },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const uploadUrl = sessionResp.data.uploadUrl;
      const chunkSize = 10 * 1024 * 1024; // 10 MB chunks
      const stream = require('fs').readFileSync(localPath);
      let offset = 0;
      while (offset < fileSize) {
        const chunk = stream.slice(offset, offset + chunkSize);
        const end = Math.min(offset + chunkSize - 1, fileSize - 1);
        await axios.put(uploadUrl, chunk, {
          headers: {
            'Content-Range': `bytes ${offset}-${end}/${fileSize}`,
            'Content-Length': chunk.length.toString(),
          },
        });
        offset += chunkSize;
      }
    }
  }

  async testConnection(): Promise<TestResult> {
    try {
      const token = await this.getAccessToken();
      const folderUrl = `${this.graphBase}/root:${encodeURIComponent(this.config.folderPath)}`;
      await axios.get(folderUrl, { headers: { Authorization: `Bearer ${token}` } });
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.response?.data?.error?.message || err.message };
    }
  }
}
