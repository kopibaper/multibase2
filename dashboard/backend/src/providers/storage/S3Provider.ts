import {
  S3Client,
  PutObjectCommand,
  ListBucketsCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { createReadStream, statSync } from 'fs';
import path from 'path';
import type { StorageProvider, TestResult } from './StorageProvider';

export interface S3Config {
  endpoint?: string; // for MinIO, Backblaze B2, etc.
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  pathPrefix?: string;
  forcePathStyle?: boolean; // needed for MinIO
}

export class S3Provider implements StorageProvider {
  private readonly client: S3Client;

  constructor(private readonly config: S3Config) {
    this.client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      ...(config.endpoint
        ? { endpoint: config.endpoint, forcePathStyle: config.forcePathStyle ?? true }
        : {}),
    });
  }

  async upload(localPath: string, remotePath: string): Promise<void> {
    const key = this.config.pathPrefix
      ? `${this.config.pathPrefix.replace(/\/$/, '')}/${remotePath}`
      : remotePath;

    const fileSize = statSync(localPath).size;
    const stream = createReadStream(localPath);

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: stream,
        ContentLength: fileSize,
      })
    );
  }

  async testConnection(): Promise<TestResult> {
    try {
      await this.client.send(new HeadBucketCommand({ Bucket: this.config.bucket }));
      return { success: true };
    } catch (err: any) {
      // HeadBucket returns 403 if bucket exists but no access, 404 if not found, etc.
      return { success: false, error: err.message };
    }
  }
}
