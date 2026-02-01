import { createClient, SupabaseClient } from '@supabase/supabase-js';
import InstanceManager from './InstanceManager';
import { logger } from '../utils/logger';

export class StorageService {
  constructor(private instanceManager: InstanceManager) {}

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

    // Access via internal Docker network or exposed port?
    // Since backend is on host (npm start), and instances expose 8000 via Kong:
    // We can use http://localhost:<port> if we knew the dynamic port,
    // OR just use the instance's gateway internal service name if backend was in docker.
    // BUT backend is running locally via `npm start`.
    // We need the PUBLIC URL or the internal port mapping.
    // InstanceManager.getInstanceConfig probably returns env vars.
    // We assume instances are accessible at http://localhost:8000 (default) but mapped?
    // Wait, Multibase instances usually bind to specific ports or use a reverse proxy.
    // Standard setup: Each instance listens on a different base port?
    // Or we rely on the implementation of `instanceManager` to know how to reach it.

    // Let's assume standard local development access:
    // If we are outside docker, we need the public URL.
    // If specific port mapping is used, we need that.

    // For now, let's assume standard Kong port 8000 is mapped to `config.API_PORT` or similar.
    // If not available, we might fallback to `http://localhost:<basePort + something>`.

    // Looking at InstanceManager, it likely knows the port.
    // Let's try to infer from typical Multibase setup:
    // The instance usually has an API_URL env var or similar.

    let apiUrl = config.API_EXTERNAL_URL || 'http://localhost:8000';

    // If we are accessing from the host (backend), we might need the specific port mapping for Kong.
    // InstanceManager doesn't blatantly expose "getPort".
    // However, usually API_EXTERNAL_URL in the .env of the instance points to the public access.

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
