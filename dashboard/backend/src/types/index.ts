// Multibase Dashboard TypeScript Type Definitions

export type StackType = 'classic' | 'cloud';

export interface SupabaseInstance {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'degraded' | 'healthy' | 'unhealthy';
  stackType: StackType;
  basePort: number;
  ports: PortMapping;
  credentials: InstanceCredentials;
  services: ServiceStatus[];
  health: HealthStatus;
  metrics?: ResourceMetrics;
  createdAt: Date;
  updatedAt: Date;
}

export interface PortMapping {
  kong_http: number;
  kong_https: number;
  // Cloud-Version: Diese Ports sind optional (kommen aus Shared Infrastructure)
  studio?: number;
  postgres?: number;
  pooler?: number;
  analytics?: number;
}

export interface InstanceCredentials {
  project_url: string;
  studio_url: string;
  anon_key: string;
  service_role_key: string;
  postgres_password: string;
  jwt_secret: string;
  dashboard_username: string;
  dashboard_password: string;
}

export interface ServiceStatus {
  name: string;
  containerName: string;
  status: 'running' | 'stopped' | 'healthy' | 'unhealthy' | 'starting';
  health: 'healthy' | 'unhealthy' | 'unknown';
  uptime: number; // seconds
  cpu: number; // percentage
  memory: number; // MB
}

export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy' | 'stopped';
  healthyServices: number;
  totalServices: number;
  lastChecked: Date;
}

export interface ResourceMetrics {
  cpu: number;
  memory: number;
  networkRx: number;
  networkTx: number;
  diskRead: number;
  diskWrite: number;
  timestamp: Date;
}

export interface ContainerStats {
  cpu_stats: {
    cpu_usage: {
      total_usage: number;
      percpu_usage?: number[];
    };
    system_cpu_usage: number;
    online_cpus: number;
  };
  precpu_stats: {
    cpu_usage: {
      total_usage: number;
    };
    system_cpu_usage: number;
  };
  memory_stats: {
    usage: number;
    max_usage: number;
    limit: number;
  };
  networks?: {
    [key: string]: {
      rx_bytes: number;
      tx_bytes: number;
    };
  };
  blkio_stats: {
    io_service_bytes_recursive?: Array<{
      op: string;
      value: number;
    }>;
  };
}

// Resource Limits for Docker containers
export interface ResourceLimits {
  // CPU limit in cores (e.g., 0.5 = half a CPU, 2 = 2 CPUs)
  cpus?: number;
  // Memory limit in MB (e.g., 512, 1024, 2048)
  memory?: number;
  // Preset name for UI display
  preset?: 'small' | 'medium' | 'large' | 'custom';
}

// Preset definitions
export const RESOURCE_PRESETS: Record<string, ResourceLimits> = {
  small: { cpus: 0.5, memory: 512, preset: 'small' },
  medium: { cpus: 1, memory: 1024, preset: 'medium' },
  large: { cpus: 2, memory: 2048, preset: 'large' },
};

export interface CreateInstanceRequest {
  name: string;
  basePort?: number;
  deploymentType: 'localhost' | 'cloud';
  domain?: string;
  protocol?: 'http' | 'https';
  corsOrigins?: string[];
  templateId?: number;
  env?: Record<string, string>;
  resourceLimits?: ResourceLimits;
}

export interface UpdateInstanceRequest {
  corsOrigins?: string[];
  domain?: string;
  protocol?: 'http' | 'https';
  regenerateKeys?: boolean;
}

export interface AlertRule {
  id?: number;
  instanceId: string;
  name: string;
  rule:
    | 'service_down'
    | 'high_cpu'
    | 'high_memory'
    | 'high_disk'
    | 'error_rate'
    | 'connection_count';
  condition: AlertCondition;
  threshold?: number;
  duration?: number; // seconds
  enabled: boolean;
  notificationChannels?: ('browser' | 'webhook')[];
  webhookUrl?: string;
}

export interface AlertCondition {
  operator: '>' | '<' | '=' | '>=' | '<=';
  value: number;
  service?: string;
}

export interface Alert {
  id: number;
  instanceId: string;
  name: string;
  rule: string;
  message: string;
  status: 'active' | 'acknowledged' | 'resolved';
  triggeredAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
}

export interface DockerContainerInfo {
  Id: string;
  Name: string;
  State: {
    Status: string;
    Running: boolean;
    StartedAt: string;
  };
  Config: {
    Labels: {
      [key: string]: string;
    };
  };
  NetworkSettings: {
    Ports: {
      [key: string]: Array<{
        HostPort: string;
      }> | null;
    };
  };
}

export interface LogFilter {
  instanceId?: string;
  service?: string;
  level?: 'error' | 'warn' | 'info' | 'debug';
  search?: string;
  since?: Date;
  tail?: number;
}

export interface EnvConfig {
  [key: string]: string;
}

export interface SystemMetrics {
  totalCpu: number;
  totalMemory: number;
  totalDisk: number;
  hostTotalMemory?: number;
  hostDiskTotal?: number;
  hostDiskUsed?: number;
  instanceCount: number;
  runningCount: number;
  sharedInfraStatus?: 'running' | 'stopped' | 'degraded' | 'unknown';
  timestamp: Date;
}

// Shared Infrastructure Types (Cloud-Version)
export interface SharedInfraStatus {
  status: 'running' | 'stopped' | 'degraded';
  services: SharedServiceStatus[];
  databases?: SharedDatabase[];
  ports: SharedPorts;
  lastChecked?: Date;
}

export interface SharedServiceStatus {
  name: string;
  containerName?: string;
  status: 'running' | 'stopped' | 'healthy' | 'unhealthy';
  uptime?: number;
  cpu?: number;
  memory?: number;
}

export interface SharedDatabase {
  name: string;
  projectName: string;
  size?: string;
  connections?: number;
}

export interface SharedPorts {
  postgres?: number;
  studio?: number;
  analytics?: number;
  pooler?: number;
  kong?: number;
  meta?: number;
}

// Shared Infrastructure Config
export const SHARED_SERVICES = [
  'multibase-db',
  'multibase-studio',
  'multibase-analytics',
  'multibase-vector',
  'multibase-imgproxy',
  'multibase-meta',
  'multibase-pooler',
  'multibase-kong',
] as const;

export const TENANT_SERVICES = [
  'kong', 'auth', 'rest', 'realtime', 'storage', 'edge-functions'
] as const;
