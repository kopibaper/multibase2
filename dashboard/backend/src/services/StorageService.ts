import { createClient, SupabaseClient } from '@supabase/supabase-js';
import InstanceManager from './InstanceManager';
import { logger } from '../utils/logger';

export class StorageService {
  constructor(private instanceManager: InstanceManager) {}

  private resolveApiUrl(config: Record<string, string>): string {
    const directUrl =
      config.SUPABASE_PUBLIC_URL ||
      config.API_EXTERNAL_URL ||
      config.API_EXTERNAL_URL_FINAL ||
      '';

    if (directUrl) {
      return directUrl.replace(/\/+$/, '');
    }

    const kongPort = config.KONG_HTTP_PORT;
    if (kongPort) {
      return `http://localhost:${kongPort}`;
    }

    return 'http://localhost:8000';
  }

  /**
   * Get a Supabase admin client for the specific instance
   */
  private async getClient(instanceName: string): Promise<SupabaseClient> {
    const config = await this.instanceManager.getInstanceEnv(instanceName);
    if (!config) {
      throw new Error(`Instance ${instanceName} not found or config missing`);
    }

    const serviceRoleKey = config.SERVICE_ROLE_KEY;
    if (!serviceRoleKey) {
      throw new Error(`Service role key missing for ${instanceName}`);
    }

    const apiUrl = this.resolveApiUrl(config);

    return createClient(apiUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async listBuckets(instanceName: string) {
    const supabase = await this.getClient(instanceName);
    const { data, error } = await supabase.storage.listBuckets();
    if (error) throw error;
    return data;
  }

  async createBucket(instanceName: string, name: string, isPublic: boolean = false) {
    const supabase = await this.getClient(instanceName);
    const { data, error } = await supabase.storage.createBucket(name, {
      public: isPublic,
    });
    if (error) throw error;
    return data;
  }

  async deleteBucket(instanceName: string, id: string) {
    const supabase = await this.getClient(instanceName);
    const { data, error } = await supabase.storage.deleteBucket(id);
    if (error) throw error;
    return data;
  }

  async listFiles(instanceName: string, bucketId: string, path: string = '') {
    const supabase = await this.getClient(instanceName);
    const { data, error } = await supabase.storage.from(bucketId).list(path, {
      limit: 100,
      offset: 0,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw error;
    return data;
  }

  async uploadFile(
    instanceName: string,
    bucketId: string,
    filePath: string,
    file: Buffer,
    contentType: string
  ) {
    const supabase = await this.getClient(instanceName);
    const { data, error } = await supabase.storage.from(bucketId).upload(filePath, file, {
      contentType,
      upsert: true,
    });
    if (error) throw error;
    return data;
  }

  async deleteFile(instanceName: string, bucketId: string, filePath: string) {
    const supabase = await this.getClient(instanceName);
    const { data, error } = await supabase.storage.from(bucketId).remove([filePath]);
    if (error) throw error;
    return data;
  }

  async getPublicUrl(instanceName: string, bucketId: string, filePath: string) {
    const supabase = await this.getClient(instanceName);
    const { data } = supabase.storage.from(bucketId).getPublicUrl(filePath);
    return data;
  }

  async createSignedUrl(
    instanceName: string,
    bucketId: string,
    filePath: string,
    expiresIn: number = 60
  ) {
    const supabase = await this.getClient(instanceName);
    const { data, error } = await supabase.storage
      .from(bucketId)
      .createSignedUrl(filePath, expiresIn);
    if (error) throw error;
    return data;
  }
}
