// Multibase Dashboard Frontend Types

// Stack Type: 'classic' = full per-project stack, 'cloud' = shared infra + lightweight tenant
export type StackType = 'classic' | 'cloud';

export interface SupabaseInstance {
  id: string;
  name: string;
  status: 'running' | 'stopped' | 'degraded' | 'healthy' | 'unhealthy';
  stackType?: StackType;
  basePort: number;
  ports: PortMapping;
  credentials: InstanceCredentials;
  services: ServiceStatus[];
  health: HealthStatus;
  metrics?: ResourceMetrics;
  createdAt: string;
  updatedAt: string;
}

export interface PortMapping {
  kong_http: number;
  kong_https: number;
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
  uptime: number;
  cpu: number;
  memory: number;
}

export interface HealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy' | 'stopped';
  healthyServices: number;
  totalServices: number;
  lastChecked: string;
}

export interface ResourceMetrics {
  cpu: number;
  memory: number;
  networkRx: number;
  networkTx: number;
  diskRead: number;
  diskWrite: number;
  timestamp: string;
}

// Resource Limits for Docker containers
export interface ResourceLimits {
  cpus?: number;
  memory?: number;
  preset?: 'small' | 'medium' | 'large' | 'custom';
}

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
  services?: string[];
  env?: Record<string, string>;
  resourceLimits?: ResourceLimits;
}

export interface SystemTemplate {
  services: {
    name: string;
    image?: string;
    environment?: any;
    ports?: string[];
    depends_on?: any;
  }[];
  envVars: string[];
  raw: any;
}

export interface TemplateConfig {
  deploymentType: 'localhost' | 'cloud';
  basePort?: number;
  domain?: string;
  protocol?: 'http' | 'https';
  corsOrigins?: string[];
  services?: string[];
  env?: Record<string, string>;
}

export interface SystemMetrics {
  totalCpu: number;
  totalMemory: number;
  totalDisk: number;
  instanceCount: number;
  runningCount: number;
  timestamp: string;
}

export interface Alert {
  id: number;
  instanceId: string;
  name: string;
  rule: string;
  condition: string;
  threshold?: number;
  duration?: number;
  enabled: boolean;
  status: 'active' | 'acknowledged' | 'resolved';
  triggeredAt?: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
  message?: string;
  notificationChannels?: string;
  webhookUrl?: string;
  createdAt: string;
  updatedAt: string;
  instance?: {
    name: string;
    status?: string;
  };
}

export interface AlertStats {
  total: number;
  active: number;
  acknowledged: number;
  resolved: number;
}

export interface CreateAlertRuleRequest {
  instanceId: string;
  name: string;
  rule: string;
  condition: any;
  threshold?: number;
  duration?: number;
  enabled?: boolean;
  notificationChannels?: string[];
  webhookUrl?: string;
}

// API Keys
export interface ApiKey {
  id: number;
  userId: number;
  name: string;
  keyPrefix: string;
  scopes: string[]; // e.g. ["instances:read", "*"]
  expiresAt: string | null;
  lastUsedAt: string | null;
  usageCount: number;
  createdAt: string;
}

export interface CreateApiKeyRequest {
  name: string;
  scopes?: string[];
  expiresIn?: number; // days
}

export interface CreateApiKeyResponse extends ApiKey {
  key: string; // The full key (only returned once)
  warning: string;
}

export interface InstanceTemplate {
  id: number;
  name: string;
  description?: string;
  config: any;
  isPublic: boolean;
  createdBy: string;
  creator?: {
    id: string;
    username: string;
  };
  createdAt: string;
  updatedAt: string;
}

// =====================================================
// Shared Infrastructure Types (Cloud-Version)
// =====================================================

export interface SharedInfraStatus {
  status: 'running' | 'stopped' | 'degraded';
  services: SharedServiceStatus[];
  ports: SharedPorts;
  totalServices: number;
  runningServices: number;
}

export interface SharedServiceStatus {
  name: string;
  status: string;
  health: 'healthy' | 'unhealthy' | 'unknown';
  uptime?: number;
  cpu?: number;
  memory?: number;
}

export interface SharedPorts {
  postgres?: number;
  studio?: number;
  analytics?: number;
  pooler?: number;
  kong?: number;
  meta?: number;
}

export interface SharedDatabase {
  name: string;
  projectName: string;
  sizeBytes: number;
  sizeFormatted: string;
}

export interface SharedDatabasesResponse {
  databases: SharedDatabase[];
  count: number;
}

export interface SharedMetrics {
  cpu: number;
  memory: number;
  disk: number;
  containerCount: number;
  timestamp: string;
}
