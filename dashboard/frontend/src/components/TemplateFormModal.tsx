import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  X,
  Save,
  Layers,
  Box,
  Settings,
  Lock,
  Database,
  Mail,
  Shield,
  Globe,
  Github,
  Facebook,
  Twitter,
  Disc,
  Server,
  Zap,
} from 'lucide-react';
import { templatesApi, settingsApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { InstanceTemplate } from '../types';
import { toast } from 'sonner';
import { Switch } from './ui/Switch';
import { cn } from '../lib/utils';

// Helper to manage Auth Provider Icon mapping
const ProviderIcons: Record<string, any> = {
  google: Globe,
  github: Github,
  discord: Disc,
  facebook: Facebook,
  twitter: Twitter,
  gitlab: Box,
  bitbucket: Box,
  apple: Box,
};

const authProviders = ['google', 'github', 'discord', 'facebook', 'twitter', 'gitlab', 'bitbucket', 'apple'];

interface TemplateFormModalProps {
  isOpen: boolean;
  template?: InstanceTemplate | null; // If provided, we're in Edit mode
  onClose: () => void;
  onSuccess: () => void;
}

export default function TemplateFormModal({ isOpen, template, onClose, onSuccess }: TemplateFormModalProps) {
  const { user } = useAuth();
  const isEditMode = !!template;

  const [activeTab, setActiveTab] = useState<
    'general' | 'deployment' | 'services' | 'database' | 'auth' | 'api' | 'storage' | 'env'
  >('general');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isPublic: false,
    config: {
      deploymentType: 'localhost',
      basePort: 8000,
      services: [] as string[],
      env: {} as Record<string, string>,
    } as any,
  });

  // Populate form when editing
  useEffect(() => {
    if (template) {
      setFormData({
        name: template.name,
        description: template.description || '',
        isPublic: template.isPublic,
        config: template.config || {
          deploymentType: 'localhost',
          basePort: 8000,
          services: [],
          env: {},
        },
      });
    } else if (isOpen) {
      // Reset for create mode
      setFormData({
        name: '',
        description: '',
        isPublic: false,
        config: {
          deploymentType: 'localhost',
          basePort: 8000,
          services: [],
          env: {},
        },
      });
    }
    setActiveTab('general');
  }, [template, isOpen]);

  // Auto-fill URLs when name or deployment type changes (Only in Create Mode or if explicitly changed)
  // Derive domain from VITE_API_URL (e.g., https://backend.tyto-design.de -> backend.tyto-design.de)
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
  const derivedDomain = (() => {
    try {
      return new URL(apiUrl).hostname;
    } catch {
      return 'localhost';
    }
  })();

  // Fetch system settings for CORS defaults
  const { data: systemSettings } = useQuery({
    queryKey: ['systemSettings'],
    queryFn: settingsApi.getSystem,
    enabled: isOpen,
  });

  useEffect(() => {
    if (isEditMode) return; // Don't overwrite existing templates

    if (formData.config.deploymentType === 'cloud' && formData.name) {
      const domain = derivedDomain;
      const sanitizedName = formData.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');

      setFormData((prev) => ({
        ...prev,
        config: {
          ...prev.config,
          corsOrigins: systemSettings?.cors ? systemSettings.cors.split(',') : prev.config.corsOrigins,
          env: {
            ...prev.config.env,
            SUPABASE_PUBLIC_URL: `https://${sanitizedName}.${domain}`,
            API_EXTERNAL_URL: `https://${sanitizedName}-api.${domain}`,
          },
        },
      }));
    } else if (formData.config.deploymentType === 'localhost') {
      setFormData((prev) => ({
        ...prev,
        config: {
          ...prev.config,
          env: {
            ...prev.config.env,
            SUPABASE_PUBLIC_URL: `http://localhost:${prev.config.basePort}`,
            API_EXTERNAL_URL: `http://localhost:${prev.config.basePort}`,
          },
        },
      }));
    }
  }, [
    formData.name,
    formData.config.deploymentType,
    formData.config.basePort,
    isEditMode,
    derivedDomain,
    systemSettings,
  ]);

  // Fetch System Template
  const { data: systemTemplate } = useQuery({
    queryKey: ['systemTemplate'],
    queryFn: templatesApi.getSystemTemplate,
    enabled: isOpen,
  });

  const createMutation = useMutation({
    mutationFn: templatesApi.create,
    onSuccess: () => {
      toast.success('Template created successfully');
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create template');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) => templatesApi.update(id, data),
    onSuccess: () => {
      toast.success('Template updated successfully');
      onSuccess();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update template');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEditMode && template) {
      updateMutation.mutate({ id: template.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const toggleService = (service: string) => {
    const current = formData.config.services || [];
    const updated = current.includes(service) ? current.filter((s: string) => s !== service) : [...current, service];
    setFormData({ ...formData, config: { ...formData.config, services: updated } });
  };

  const updateEnv = (key: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      config: {
        ...prev.config,
        env: { ...prev.config.env, [key]: value },
      },
    }));
  };

  // Helper to get env var safely
  const getEnv = (key: string) => formData.config.env?.[key] || '';

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (!isOpen) return null;

  const tabs = [
    { id: 'general', label: 'General Info', shortLabel: 'General', icon: Layers },
    { id: 'deployment', label: 'Deployment', shortLabel: 'Deploy', icon: () => <Settings className='w-4 h-4' /> },
    { id: 'services', label: 'Services', shortLabel: 'Services', icon: Box },
    { id: 'database', label: 'Database', shortLabel: 'Database', icon: Database },
    { id: 'auth', label: 'Authentication', shortLabel: 'Auth', icon: Lock },
    { id: 'api', label: 'API & Realtime', shortLabel: 'API', icon: Server },
    { id: 'storage', label: 'Storage', shortLabel: 'Storage', icon: Layers },
    { id: 'env', label: 'Environment', shortLabel: 'Env', icon: Settings },
  ] as const;

  return (
    <div className='fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4'>
      {/* Full-screen on mobile, constrained on sm+ */}
      <div className='glass-modal w-full max-w-4xl flex flex-col h-full sm:h-auto sm:max-h-[90vh] rounded-none sm:rounded-xl'>
        {/* Header */}
        <div className='flex items-center justify-between p-4 sm:p-6 border-b border-border flex-shrink-0'>
          <div>
            <h2 className='text-xl font-semibold flex items-center gap-2'>
              {isEditMode ? <Settings className='w-5 h-5 text-primary' /> : <Layers className='w-5 h-5 text-primary' />}
              {isEditMode ? 'Edit Template' : 'Create New Template'}
            </h2>
            <p className='text-sm text-muted-foreground mt-1'>Define the configuration for future instances.</p>
          </div>
          <button onClick={onClose} className='p-2 hover:bg-secondary rounded-full transition-colors'>
            <X className='w-5 h-5' />
          </button>
        </div>

        <div className='flex flex-1 overflow-hidden flex-col md:flex-row'>
          {/* Mobile: horizontal scrollable tab bar (icons + short labels) */}
          <div className='md:hidden border-b border-border bg-secondary/10 flex overflow-x-auto scrollbar-none flex-shrink-0'>
            {tabs.map((tab) => {
              const Icon = tab.icon as any;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex flex-col items-center gap-1 px-3 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 flex-shrink-0',
                    activeTab === tab.id
                      ? 'border-primary text-primary bg-secondary/30'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className='w-4 h-4' />
                  {tab.shortLabel}
                </button>
              );
            })}
          </div>

          {/* Desktop: Sidebar Tabs */}
          <div className='hidden md:flex w-48 border-r border-border bg-secondary/10 flex-col flex-shrink-0'>
            {tabs.map((tab) => {
              const Icon = tab.icon as any;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors text-left border-l-2',
                    activeTab === tab.id
                      ? 'border-primary bg-secondary text-primary'
                      : 'border-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                  )}
                >
                  <Icon className='w-4 h-4' />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Content Area */}
          <div className='flex-1 p-4 sm:p-6 overflow-y-auto bg-card'>
            <form id='template-form' onSubmit={handleSubmit} className='space-y-6 max-w-2xl mx-auto'>
              {activeTab === 'general' && (
                <div className='space-y-4 animate-in fade-in'>
                  <div className='grid gap-2'>
                    <label className='text-sm font-medium'>Template Name *</label>
                    <input
                      type='text'
                      required
                      placeholder='e.g. Production Stack'
                      className='w-full px-3 py-2 rounded-md border border-input bg-background'
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  <div className='grid gap-2'>
                    <label className='text-sm font-medium'>Description</label>
                    <textarea
                      rows={3}
                      placeholder='Describe what this template is for...'
                      className='w-full px-3 py-2 rounded-md border border-input bg-background'
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    />
                  </div>

                  {user?.role === 'admin' && (
                    <div className='flex items-center justify-between p-4 border border-border rounded-md bg-secondary/5'>
                      <div className='space-y-0.5'>
                        <label className='text-sm font-medium'>Public Template</label>
                        <p className='text-xs text-muted-foreground'>Make this template visible to all users.</p>
                      </div>
                      <Switch
                        checked={formData.isPublic}
                        onCheckedChange={(checked) => setFormData({ ...formData, isPublic: checked })}
                      />
                    </div>
                  )}

                  <div className='grid gap-2 border-t border-border pt-4 mt-4'>
                    <label className='text-sm font-medium flex items-center gap-2'>
                      <Zap className='w-4 h-4 text-yellow-500' />
                      OpenAI API Key (Optional)
                    </label>
                    <input
                      type='password'
                      className='w-full px-3 py-2 rounded-md border border-input bg-background'
                      value={getEnv('OPENAI_API_KEY')}
                      onChange={(e) => updateEnv('OPENAI_API_KEY', e.target.value)}
                      placeholder='sk-...'
                    />
                    <p className='text-xs text-muted-foreground'>Enables AI features in Supabase Studio SQL Editor.</p>
                  </div>
                </div>
              )}

              {activeTab === 'deployment' && (
                <div className='space-y-6 animate-in fade-in'>
                  <div className='grid gap-2'>
                    <label className='text-sm font-medium'>Default Deployment Type</label>
                    <select
                      className='w-full px-3 py-2 rounded-md border border-input bg-background'
                      value={formData.config.deploymentType}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          config: { ...formData.config, deploymentType: e.target.value },
                        })
                      }
                    >
                      <option value='localhost'>Localhost (Dev)</option>
                      <option value='cloud'>Cloud / VPS (Prod)</option>
                    </select>
                    <p className='text-xs text-muted-foreground'>
                      Defaults to this mode when user selects this template.
                    </p>
                  </div>

                  <div className='grid gap-2'>
                    <label className='text-sm font-medium'>Base Port Offset</label>
                    <input
                      type='number'
                      className='w-full px-3 py-2 rounded-md border border-input bg-background'
                      value={formData.config.basePort}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          config: { ...formData.config, basePort: parseInt(e.target.value) },
                        })
                      }
                    />
                    <p className='text-xs text-muted-foreground'>Starting port number logic.</p>
                  </div>

                  <div className='bg-secondary/20 p-4 rounded-lg border border-border mt-6'>
                    <div className='flex items-center gap-2 border-b border-border pb-2 mb-4'>
                      <Globe className='w-4 h-4 text-primary' />
                      <h3 className='font-semibold'>Connectivity & Public Access</h3>
                    </div>

                    {formData.config.deploymentType === 'cloud' ? (
                      <div className='bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 p-3 rounded-md text-sm mb-4 border border-yellow-500/20'>
                        <strong>Cloud / VPS Mode:</strong> Please ensure your DNS is configured correctly.
                        <br />
                        Example: <code>https://supabase.your-domain.com</code>
                      </div>
                    ) : (
                      <div className='bg-blue-500/10 text-blue-600 dark:text-blue-400 p-3 rounded-md text-sm mb-4 border border-blue-500/20'>
                        <strong>Localhost Mode:</strong> Typically uses <code>http://localhost:8000</code>.
                      </div>
                    )}

                    <div className='grid gap-4'>
                      <div className='space-y-2'>
                        <label className='text-sm font-medium'>Public URL (SUPABASE_PUBLIC_URL)</label>
                        <input
                          type='text'
                          className='w-full px-3 py-2 rounded-md border border-input bg-background'
                          value={getEnv('SUPABASE_PUBLIC_URL')}
                          onChange={(e) => updateEnv('SUPABASE_PUBLIC_URL', e.target.value)}
                          placeholder={
                            formData.config.deploymentType === 'cloud'
                              ? 'https://your-project.com'
                              : 'http://localhost:8000'
                          }
                        />
                        <p className='text-xs text-muted-foreground'> The core URL for your Supabase instance.</p>
                      </div>
                      <div className='space-y-2'>
                        <label className='text-sm font-medium'>API External URL (API_EXTERNAL_URL)</label>
                        <input
                          type='text'
                          className='w-full px-3 py-2 rounded-md border border-input bg-background'
                          value={getEnv('API_EXTERNAL_URL')}
                          onChange={(e) => updateEnv('API_EXTERNAL_URL', e.target.value)}
                          placeholder={
                            formData.config.deploymentType === 'cloud'
                              ? 'https://your-project.com'
                              : 'http://localhost:8000'
                          }
                        />
                        <p className='text-xs text-muted-foreground'>Used for Auth redirects and external access.</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'services' && (
                <div className='space-y-4 animate-in fade-in'>
                  <div className='flex items-center justify-between'>
                    <p className='text-sm text-muted-foreground'>Enable services included in this template.</p>
                    <span className='text-xs bg-secondary px-2 py-1 rounded'>
                      {(formData.config.services || []).length} Enabled
                    </span>
                  </div>

                  <div className='grid grid-cols-1 md:grid-cols-2 gap-3'>
                    {systemTemplate?.services.map((service) => {
                      const isEnabled =
                        (formData.config.services || []).includes(service.name) ||
                        (formData.config.services || []).length === 0;

                      return (
                        <div
                          key={service.name}
                          className={cn(
                            'flex items-center justify-between p-3 border rounded-md transition-all',
                            isEnabled ? 'border-primary/50 bg-primary/5' : 'border-border hover:bg-secondary/10'
                          )}
                        >
                          <div className='flex flex-col'>
                            <span className='font-medium text-sm'>{service.name}</span>
                            <span className='text-xs text-muted-foreground truncate w-32' title={service.image}>
                              {service.image?.split(':')[0]}
                            </span>
                          </div>

                          <Switch checked={isEnabled} onCheckedChange={() => toggleService(service.name)} />
                        </div>
                      );
                    })}
                    {!systemTemplate && (
                      <div className='col-span-2 text-center py-8 text-muted-foreground'>Loading services...</div>
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'database' && (
                <div className='space-y-6 animate-in fade-in'>
                  <div className='bg-secondary/20 p-4 rounded-lg border border-border'>
                    <div className='flex items-center gap-2 border-b border-border pb-2 mb-4'>
                      <Database className='w-5 h-5 text-primary' />
                      <h3 className='font-semibold'>Connection Pooling (Supavisor)</h3>
                    </div>
                    <p className='text-sm text-muted-foreground mb-4'>
                      Configure how clients connect to your database.
                    </p>

                    <div className='grid gap-4 md:grid-cols-2'>
                      <div className='space-y-2'>
                        <label className='text-sm font-medium'>Pool Mode</label>
                        <select
                          className='w-full px-3 py-2 rounded-md border border-input bg-background'
                          value={getEnv('POOLER_POOL_MODE') || 'transaction'}
                          onChange={(e) => updateEnv('POOLER_POOL_MODE', e.target.value)}
                        >
                          <option value='transaction'>Transaction (Recommended)</option>
                          <option value='session'>Session</option>
                        </select>
                        <p className='text-xs text-muted-foreground'>
                          Transaction mode creates a temporary connection for each transaction.
                        </p>
                      </div>

                      <div className='space-y-2'>
                        <label className='text-sm font-medium'>Max Client Connections</label>
                        <input
                          type='number'
                          className='w-full px-3 py-2 rounded-md border border-input bg-background'
                          value={getEnv('POOLER_MAX_CLIENT_CONN')}
                          onChange={(e) => updateEnv('POOLER_MAX_CLIENT_CONN', e.target.value)}
                          placeholder='100'
                        />
                      </div>

                      <div className='space-y-2'>
                        <label className='text-sm font-medium'>Default Pool Size</label>
                        <input
                          type='number'
                          className='w-full px-3 py-2 rounded-md border border-input bg-background'
                          value={getEnv('POOLER_DEFAULT_POOL_SIZE')}
                          onChange={(e) => updateEnv('POOLER_DEFAULT_POOL_SIZE', e.target.value)}
                          placeholder='20'
                        />
                      </div>

                      <div className='space-y-2'>
                        <label className='text-sm font-medium'>Postgres Port</label>
                        <input
                          type='number'
                          className='w-full px-3 py-2 rounded-md border border-input bg-background'
                          value={getEnv('POSTGRES_PORT')}
                          onChange={(e) => updateEnv('POSTGRES_PORT', e.target.value)}
                          placeholder='5432'
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'api' && (
                <div className='space-y-6 animate-in fade-in'>
                  {/* PostgREST */}
                  <div className='bg-secondary/20 p-4 rounded-lg border border-border'>
                    <div className='flex items-center gap-2 border-b border-border pb-2 mb-4'>
                      <Server className='w-5 h-5 text-primary' />
                      <h3 className='font-semibold'>API (PostgREST)</h3>
                    </div>

                    <div className='grid gap-4'>
                      <div className='space-y-2'>
                        <label className='text-sm font-medium'>Exposed Schemas</label>
                        <input
                          type='text'
                          className='w-full px-3 py-2 rounded-md border border-input bg-background'
                          value={getEnv('PGRST_DB_SCHEMAS')}
                          onChange={(e) => updateEnv('PGRST_DB_SCHEMAS', e.target.value)}
                          placeholder='public,storage,graphql_public'
                        />
                        <p className='text-xs text-muted-foreground'>
                          Comma-separated list of schemas accessible via the API.
                        </p>
                      </div>
                      <div className='space-y-2'>
                        <label className='text-sm font-medium'>Max Rows (Limit)</label>
                        <input
                          type='number'
                          className='w-full px-3 py-2 rounded-md border border-input bg-background'
                          value={getEnv('PGRST_MAX_ROWS')}
                          onChange={(e) => updateEnv('PGRST_MAX_ROWS', e.target.value)}
                          placeholder='Undefined (No limit)'
                        />
                      </div>
                    </div>
                  </div>

                  {/* Realtime */}
                  <div className='bg-secondary/20 p-4 rounded-lg border border-border'>
                    <div className='flex items-center gap-2 border-b border-border pb-2 mb-4'>
                      <Zap className='w-5 h-5 text-primary' />
                      <h3 className='font-semibold'>Realtime</h3>
                    </div>
                    <div className='grid gap-4'>
                      <div className='flex items-center justify-between'>
                        <div className='space-y-0.5'>
                          <label className='text-sm font-medium'>Enable Realtime</label>
                          <p className='text-xs text-muted-foreground'>Allow WebSocket connections.</p>
                        </div>
                        {/* Often controlled by service presence, but maybe we can toggle env? 
                                    Realtime service is usually always there if enabled in Services tab.
                                    Here we can configure limits. */}
                      </div>
                      <div className='space-y-2'>
                        <label className='text-sm font-medium'>Max Header Length</label>
                        <input
                          type='number'
                          className='w-full px-3 py-2 rounded-md border border-input bg-background'
                          value={getEnv('REALTIME_MAX_HEADER_LENGTH')}
                          onChange={(e) => updateEnv('REALTIME_MAX_HEADER_LENGTH', e.target.value)}
                          placeholder='4096'
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'database' && (
                <div className='space-y-6 animate-in fade-in'>
                  <div className='bg-secondary/20 p-4 rounded-lg border border-border'>
                    <div className='flex items-center gap-2 border-b border-border pb-2 mb-4'>
                      <Database className='w-5 h-5 text-primary' />
                      <h3 className='font-semibold'>Connection Pooling (Supavisor)</h3>
                    </div>
                    <p className='text-sm text-muted-foreground mb-4'>
                      Configure how clients connect to your database.
                    </p>

                    <div className='grid gap-4 md:grid-cols-2'>
                      <div className='space-y-2'>
                        <label className='text-sm font-medium'>Pool Mode</label>
                        <select
                          className='w-full px-3 py-2 rounded-md border border-input bg-background'
                          value={getEnv('POOLER_POOL_MODE') || 'transaction'}
                          onChange={(e) => updateEnv('POOLER_POOL_MODE', e.target.value)}
                        >
                          <option value='transaction'>Transaction (Recommended)</option>
                          <option value='session'>Session</option>
                        </select>
                        <p className='text-xs text-muted-foreground'>
                          Transaction mode creates a temporary connection for each transaction.
                        </p>
                      </div>

                      <div className='space-y-2'>
                        <label className='text-sm font-medium'>Max Client Connections</label>
                        <input
                          type='number'
                          className='w-full px-3 py-2 rounded-md border border-input bg-background'
                          value={getEnv('POOLER_MAX_CLIENT_CONN')}
                          onChange={(e) => updateEnv('POOLER_MAX_CLIENT_CONN', e.target.value)}
                          placeholder='100'
                        />
                      </div>

                      <div className='space-y-2'>
                        <label className='text-sm font-medium'>Default Pool Size</label>
                        <input
                          type='number'
                          className='w-full px-3 py-2 rounded-md border border-input bg-background'
                          value={getEnv('POOLER_DEFAULT_POOL_SIZE')}
                          onChange={(e) => updateEnv('POOLER_DEFAULT_POOL_SIZE', e.target.value)}
                          placeholder='20'
                        />
                      </div>

                      <div className='space-y-2'>
                        <label className='text-sm font-medium'>Postgres Port</label>
                        <input
                          type='number'
                          className='w-full px-3 py-2 rounded-md border border-input bg-background'
                          value={getEnv('POSTGRES_PORT')}
                          onChange={(e) => updateEnv('POSTGRES_PORT', e.target.value)}
                          placeholder='5432'
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'api' && (
                <div className='space-y-6 animate-in fade-in'>
                  {/* PostgREST */}
                  <div className='bg-secondary/20 p-4 rounded-lg border border-border'>
                    <div className='flex items-center gap-2 border-b border-border pb-2 mb-4'>
                      <Server className='w-5 h-5 text-primary' />
                      <h3 className='font-semibold'>API (PostgREST)</h3>
                    </div>

                    <div className='grid gap-4'>
                      <div className='space-y-2'>
                        <label className='text-sm font-medium'>Exposed Schemas</label>
                        <input
                          type='text'
                          className='w-full px-3 py-2 rounded-md border border-input bg-background'
                          value={getEnv('PGRST_DB_SCHEMAS')}
                          onChange={(e) => updateEnv('PGRST_DB_SCHEMAS', e.target.value)}
                          placeholder='public,storage,graphql_public'
                        />
                        <p className='text-xs text-muted-foreground'>
                          Comma-separated list of schemas accessible via the API. Note: `public` is always recommended.
                        </p>
                      </div>
                      <div className='space-y-2'>
                        <label className='text-sm font-medium'>Max Rows (Limit)</label>
                        <input
                          type='number'
                          className='w-full px-3 py-2 rounded-md border border-input bg-background'
                          value={getEnv('PGRST_MAX_ROWS')}
                          onChange={(e) => updateEnv('PGRST_MAX_ROWS', e.target.value)}
                          placeholder='Undefined (No limit)'
                        />
                      </div>
                    </div>
                  </div>

                  {/* Realtime */}
                  <div className='bg-secondary/20 p-4 rounded-lg border border-border'>
                    <div className='flex items-center gap-2 border-b border-border pb-2 mb-4'>
                      <Zap className='w-5 h-5 text-primary' />
                      <h3 className='font-semibold'>Realtime</h3>
                    </div>
                    <div className='grid gap-4'>
                      <div className='space-y-2'>
                        <label className='text-sm font-medium'>Max Header Length</label>
                        <input
                          type='number'
                          className='w-full px-3 py-2 rounded-md border border-input bg-background'
                          value={getEnv('REALTIME_MAX_HEADER_LENGTH')}
                          onChange={(e) => updateEnv('REALTIME_MAX_HEADER_LENGTH', e.target.value)}
                          placeholder='4096'
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'database' && (
                <div className='space-y-6 animate-in fade-in'>
                  <div className='bg-secondary/20 p-4 rounded-lg border border-border'>
                    <div className='flex items-center gap-2 border-b border-border pb-2 mb-4'>
                      <Database className='w-5 h-5 text-primary' />
                      <h3 className='font-semibold'>Connection Pooling (Supavisor)</h3>
                    </div>
                    <p className='text-sm text-muted-foreground mb-4'>
                      Configure how clients connect to your database.
                    </p>

                    <div className='grid gap-4 md:grid-cols-2'>
                      <div className='space-y-2'>
                        <label className='text-sm font-medium'>Pool Mode</label>
                        <select
                          className='w-full px-3 py-2 rounded-md border border-input bg-background'
                          value={getEnv('POOLER_POOL_MODE') || 'transaction'}
                          onChange={(e) => updateEnv('POOLER_POOL_MODE', e.target.value)}
                        >
                          <option value='transaction'>Transaction (Recommended)</option>
                          <option value='session'>Session</option>
                        </select>
                        <p className='text-xs text-muted-foreground'>
                          Transaction mode creates a temporary connection for each transaction.
                        </p>
                      </div>

                      <div className='space-y-2'>
                        <label className='text-sm font-medium'>Max Client Connections</label>
                        <input
                          type='number'
                          className='w-full px-3 py-2 rounded-md border border-input bg-background'
                          value={getEnv('POOLER_MAX_CLIENT_CONN')}
                          onChange={(e) => updateEnv('POOLER_MAX_CLIENT_CONN', e.target.value)}
                          placeholder='100'
                        />
                      </div>

                      <div className='space-y-2'>
                        <label className='text-sm font-medium'>Default Pool Size</label>
                        <input
                          type='number'
                          className='w-full px-3 py-2 rounded-md border border-input bg-background'
                          value={getEnv('POOLER_DEFAULT_POOL_SIZE')}
                          onChange={(e) => updateEnv('POOLER_DEFAULT_POOL_SIZE', e.target.value)}
                          placeholder='20'
                        />
                      </div>

                      <div className='space-y-2'>
                        <label className='text-sm font-medium'>Postgres Port</label>
                        <input
                          type='number'
                          className='w-full px-3 py-2 rounded-md border border-input bg-background'
                          value={getEnv('POSTGRES_PORT')}
                          onChange={(e) => updateEnv('POSTGRES_PORT', e.target.value)}
                          placeholder='5432'
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'auth' && (
                <div className='space-y-8 animate-in fade-in'>
                  {/* Section 1: Auth Providers */}
                  <div className='space-y-4'>
                    <div className='flex items-center gap-2 border-b border-border pb-2'>
                      <Globe className='w-4 h-4 text-primary' />
                      <h3 className='font-semibold text-lg'>Auth Providers</h3>
                    </div>
                    <div className='space-y-3'>
                      {authProviders.map((provider) => {
                        const Icon = ProviderIcons[provider] || Globe;
                        const envPrefix = `GOTRUE_EXTERNAL_${provider.toUpperCase()}`;
                        const isEnabled = getEnv(`${envPrefix}_ENABLED`) === 'true';

                        return (
                          <div
                            key={provider}
                            className={cn(
                              'border rounded-md transition-all',
                              isEnabled ? 'bg-primary/5 border-primary/20' : 'border-border'
                            )}
                          >
                            <div className='flex items-center justify-between p-3'>
                              <div className='flex items-center gap-3'>
                                <div className='w-8 h-8 rounded-full bg-background flex items-center justify-center border border-border'>
                                  <Icon className='w-4 h-4' />
                                </div>
                                <span className='capitalize font-medium'>{provider}</span>
                              </div>
                              <Switch
                                checked={isEnabled}
                                onCheckedChange={(c) => updateEnv(`${envPrefix}_ENABLED`, String(c))}
                              />
                            </div>
                            {isEnabled && (
                              <div className='p-3 pt-0 grid gap-3 animate-in slide-in-from-top-2'>
                                <div className='grid gap-1.5'>
                                  <label className='text-xs font-medium text-muted-foreground'>Client ID</label>
                                  <input
                                    type='text'
                                    className='w-full px-2 py-1.5 text-sm rounded border border-input bg-background/50'
                                    value={getEnv(`${envPrefix}_CLIENT_ID`)}
                                    onChange={(e) => updateEnv(`${envPrefix}_CLIENT_ID`, e.target.value)}
                                  />
                                </div>
                                <div className='grid gap-1.5'>
                                  <label className='text-xs font-medium text-muted-foreground'>Client Secret</label>
                                  <input
                                    type='password'
                                    className='w-full px-2 py-1.5 text-sm rounded border border-input bg-background/50'
                                    value={getEnv(`${envPrefix}_SECRET`)}
                                    onChange={(e) => updateEnv(`${envPrefix}_SECRET`, e.target.value)}
                                  />
                                </div>
                                {provider === 'google' && (
                                  <div className='grid gap-1.5'>
                                    <label className='text-xs font-medium text-muted-foreground'>
                                      Redirect URI (Optional)
                                    </label>
                                    <input
                                      type='text'
                                      className='w-full px-2 py-1.5 text-sm rounded border border-input bg-background/50'
                                      value={getEnv(`${envPrefix}_REDIRECT_URI`)}
                                      onChange={(e) => updateEnv(`${envPrefix}_REDIRECT_URI`, e.target.value)}
                                      placeholder='Auto-inferred if empty'
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Section 2: Email & SMTP */}
                  <div className='space-y-4'>
                    <div className='flex items-center gap-2 border-b border-border pb-2'>
                      <Mail className='w-4 h-4 text-primary' />
                      <h3 className='font-semibold text-lg'>Email & SMTP</h3>
                    </div>

                    {/* General Email Toggles */}
                    <div className='space-y-3 p-4 bg-secondary/5 rounded-md border border-border'>
                      <div className='flex items-center justify-between'>
                        <div className='space-y-0.5'>
                          <label className='text-sm font-medium'>Enable Email Signup</label>
                          <p className='text-xs text-muted-foreground'>Allow users to sign up with email/password.</p>
                        </div>
                        <Switch
                          checked={getEnv('GOTRUE_EXTERNAL_EMAIL_ENABLED') !== 'false'}
                          onCheckedChange={(c) => updateEnv('GOTRUE_EXTERNAL_EMAIL_ENABLED', String(c))}
                        />
                      </div>
                      <div className='flex items-center justify-between'>
                        <div className='space-y-0.5'>
                          <label className='text-sm font-medium'>Confirm Email</label>
                          <p className='text-xs text-muted-foreground'>Require email confirmation before login.</p>
                        </div>
                        <Switch
                          checked={getEnv('GOTRUE_MAILER_AUTOCONFIRM') === 'false'}
                          onCheckedChange={(c) => updateEnv('GOTRUE_MAILER_AUTOCONFIRM', String(!c))}
                        />
                      </div>
                    </div>

                    {/* SMTP Config */}
                    <div className='border rounded-md'>
                      <div className='flex items-center justify-between p-3 bg-secondary/10 border-b border-border'>
                        <span className='font-medium text-sm'>Custom SMTP Settings</span>
                        <Switch
                          checked={getEnv('GOTRUE_SMTP_HOST') !== ''}
                          onCheckedChange={(c) => {
                            if (!c) {
                              updateEnv('GOTRUE_SMTP_HOST', '');
                            }
                          }}
                        />
                      </div>
                      {getEnv('GOTRUE_SMTP_HOST') !== '' && (
                        <div className='p-4 grid grid-cols-1 sm:grid-cols-2 gap-4 animate-in slide-in-from-top-2'>
                          <div className='col-span-2'>
                            <label className='text-xs font-medium'>Sender Email</label>
                            <input
                              type='email'
                              required
                              className='w-full px-2 py-1.5 text-sm rounded border border-input'
                              value={getEnv('GOTRUE_SMTP_ADMIN_EMAIL')}
                              onChange={(e) => updateEnv('GOTRUE_SMTP_ADMIN_EMAIL', e.target.value)}
                            />
                          </div>
                          <div className='col-span-2'>
                            <label className='text-xs font-medium'>Sender Name</label>
                            <input
                              type='text'
                              required
                              className='w-full px-2 py-1.5 text-sm rounded border border-input'
                              value={getEnv('GOTRUE_SMTP_SENDER_NAME')}
                              onChange={(e) => updateEnv('GOTRUE_SMTP_SENDER_NAME', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className='text-xs font-medium'>SMTP Host</label>
                            <input
                              type='text'
                              placeholder='smtp.example.com'
                              className='w-full px-2 py-1.5 text-sm rounded border border-input'
                              value={getEnv('GOTRUE_SMTP_HOST')}
                              onChange={(e) => updateEnv('GOTRUE_SMTP_HOST', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className='text-xs font-medium'>Port</label>
                            <input
                              type='number'
                              placeholder='587'
                              className='w-full px-2 py-1.5 text-sm rounded border border-input'
                              value={getEnv('GOTRUE_SMTP_PORT')}
                              onChange={(e) => updateEnv('GOTRUE_SMTP_PORT', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className='text-xs font-medium'>User</label>
                            <input
                              type='text'
                              className='w-full px-2 py-1.5 text-sm rounded border border-input'
                              value={getEnv('GOTRUE_SMTP_USER')}
                              onChange={(e) => updateEnv('GOTRUE_SMTP_USER', e.target.value)}
                            />
                          </div>
                          <div>
                            <label className='text-xs font-medium'>Password</label>
                            <input
                              type='password'
                              className='w-full px-2 py-1.5 text-sm rounded border border-input'
                              value={getEnv('GOTRUE_SMTP_PASS')}
                              onChange={(e) => updateEnv('GOTRUE_SMTP_PASS', e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Section 3: Security & Others */}
                  <div className='space-y-4'>
                    <div className='flex items-center gap-2 border-b border-border pb-2'>
                      <Shield className='w-4 h-4 text-primary' />
                      <h3 className='font-semibold text-lg'>Security</h3>
                    </div>
                    <div className='space-y-3 p-4 bg-secondary/5 rounded-md border border-border'>
                      <div className='flex items-center justify-between'>
                        <div className='space-y-0.5'>
                          <label className='text-sm font-medium'>Enable Anonymous Signins</label>
                          <p className='text-xs text-muted-foreground'>Allow temporary guest accounts.</p>
                        </div>
                        <Switch
                          checked={getEnv('GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED') === 'true'}
                          onCheckedChange={(c) => updateEnv('GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED', String(c))}
                        />
                      </div>
                      <div className='flex items-center justify-between'>
                        <div className='space-y-0.5'>
                          <label className='text-sm font-medium'>Enable Phone Signup</label>
                          <p className='text-xs text-muted-foreground'>Requires SMS provider configuration.</p>
                        </div>
                        <Switch
                          checked={getEnv('GOTRUE_EXTERNAL_PHONE_ENABLED') === 'true'}
                          onCheckedChange={(c) => updateEnv('GOTRUE_EXTERNAL_PHONE_ENABLED', String(c))}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'api' && (
                <div className='space-y-6 animate-in fade-in'>
                  {/* PostgREST */}
                  <div className='bg-secondary/20 p-4 rounded-lg border border-border'>
                    <div className='flex items-center gap-2 border-b border-border pb-2 mb-4'>
                      <Server className='w-5 h-5 text-primary' />
                      <h3 className='font-semibold'>API (PostgREST)</h3>
                    </div>

                    <div className='grid gap-4'>
                      <div className='space-y-2'>
                        <label className='text-sm font-medium'>Exposed Schemas</label>
                        <input
                          type='text'
                          className='w-full px-3 py-2 rounded-md border border-input bg-background'
                          value={getEnv('PGRST_DB_SCHEMAS')}
                          onChange={(e) => updateEnv('PGRST_DB_SCHEMAS', e.target.value)}
                          placeholder='public,storage,graphql_public'
                        />
                        <p className='text-xs text-muted-foreground'>
                          Comma-separated list of schemas accessible via the API. Note: `public` is always recommended.
                        </p>
                      </div>
                      <div className='space-y-2'>
                        <label className='text-sm font-medium'>Max Rows (Limit)</label>
                        <input
                          type='number'
                          className='w-full px-3 py-2 rounded-md border border-input bg-background'
                          value={getEnv('PGRST_MAX_ROWS')}
                          onChange={(e) => updateEnv('PGRST_MAX_ROWS', e.target.value)}
                          placeholder='Undefined (No limit)'
                        />
                      </div>
                    </div>
                  </div>

                  {/* Realtime */}
                  <div className='bg-secondary/20 p-4 rounded-lg border border-border'>
                    <div className='flex items-center gap-2 border-b border-border pb-2 mb-4'>
                      <Zap className='w-5 h-5 text-primary' />
                      <h3 className='font-semibold'>Realtime</h3>
                    </div>
                    <div className='grid gap-4'>
                      <div className='space-y-2'>
                        <label className='text-sm font-medium'>Max Header Length</label>
                        <input
                          type='number'
                          className='w-full px-3 py-2 rounded-md border border-input bg-background'
                          value={getEnv('REALTIME_MAX_HEADER_LENGTH')}
                          onChange={(e) => updateEnv('REALTIME_MAX_HEADER_LENGTH', e.target.value)}
                          placeholder='4096'
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'storage' && (
                <div className='space-y-6 animate-in fade-in'>
                  <div className='bg-secondary/20 p-4 rounded-lg border border-border'>
                    <h3 className='font-medium mb-1'>Storage Backend</h3>
                    <p className='text-sm text-muted-foreground mb-4'>
                      Choose how Supabase stores uploaded files. "Internal" uses the disk (Docker Volume). "External"
                      uses S3-compatible services (AWS, MinIO, etc.).
                    </p>

                    <div className='grid grid-cols-2 gap-4'>
                      <button
                        type='button'
                        onClick={() => updateEnv('STORAGE_BACKEND', 'file')}
                        className={cn(
                          'p-4 border rounded-lg flex flex-col items-center gap-2 transition-all',
                          (getEnv('STORAGE_BACKEND') || 'file') === 'file'
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'hover:bg-secondary/50'
                        )}
                      >
                        <Database className='w-6 h-6' />
                        <span className='font-medium'>Internal (File)</span>
                      </button>
                      <button
                        type='button'
                        onClick={() => updateEnv('STORAGE_BACKEND', 's3')}
                        className={cn(
                          'p-4 border rounded-lg flex flex-col items-center gap-2 transition-all',
                          getEnv('STORAGE_BACKEND') === 's3'
                            ? 'bg-primary/10 border-primary text-primary'
                            : 'hover:bg-secondary/50'
                        )}
                      >
                        <Globe className='w-6 h-6' />
                        <span className='font-medium'>External (S3)</span>
                      </button>
                    </div>
                  </div>

                  {getEnv('STORAGE_BACKEND') === 's3' && (
                    <div className='space-y-4 animate-in slide-in-from-top-2'>
                      <div className='flex items-center gap-2 border-b border-border pb-2 mt-6'>
                        <Settings className='w-4 h-4 text-primary' />
                        <h3 className='font-semibold'>S3 Configuration</h3>
                      </div>

                      <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                        <div className='space-y-2'>
                          <label className='text-sm font-medium'>Region</label>
                          <input
                            type='text'
                            placeholder='us-east-1'
                            className='w-full px-3 py-2 rounded-md border border-input bg-background'
                            value={getEnv('REGION')}
                            onChange={(e) => updateEnv('REGION', e.target.value)}
                          />
                        </div>
                        <div className='space-y-2'>
                          <label className='text-sm font-medium'>Bucket Name</label>
                          <input
                            type='text'
                            placeholder='my-supabase-bucket'
                            className='w-full px-3 py-2 rounded-md border border-input bg-background'
                            value={getEnv('GLOBAL_S3_BUCKET')}
                            onChange={(e) => updateEnv('GLOBAL_S3_BUCKET', e.target.value)}
                          />
                        </div>
                        <div className='space-y-2 col-span-2'>
                          <label className='text-sm font-medium'>Endpoint URL (Optional)</label>
                          <input
                            type='text'
                            placeholder='https://s3.amazonaws.com'
                            className='w-full px-3 py-2 rounded-md border border-input bg-background'
                            value={getEnv('STORAGE_S3_ENDPOINT')}
                            onChange={(e) => updateEnv('STORAGE_S3_ENDPOINT', e.target.value)}
                          />
                          <p className='text-xs text-muted-foreground'>Required for MinIO, DigitalOcean Spaces, etc.</p>
                        </div>
                        <div className='space-y-2'>
                          <label className='text-sm font-medium'>Access Key ID</label>
                          <input
                            type='text'
                            className='w-full px-3 py-2 rounded-md border border-input bg-background'
                            value={getEnv('AWS_ACCESS_KEY_ID')}
                            onChange={(e) => updateEnv('AWS_ACCESS_KEY_ID', e.target.value)}
                          />
                        </div>
                        <div className='space-y-2'>
                          <label className='text-sm font-medium'>Secret Access Key</label>
                          <input
                            type='password'
                            className='w-full px-3 py-2 rounded-md border border-input bg-background'
                            value={getEnv('AWS_SECRET_ACCESS_KEY')}
                            onChange={(e) => updateEnv('AWS_SECRET_ACCESS_KEY', e.target.value)}
                          />
                        </div>

                        <div className='flex items-center justify-between col-span-2 p-3 border rounded-md'>
                          <div className='space-y-0.5'>
                            <label className='text-sm font-medium'>Force Path Style</label>
                            <p className='text-xs text-muted-foreground'>Often needed for MinIO or self-hosted S3.</p>
                          </div>
                          <Switch
                            checked={getEnv('STORAGE_S3_FORCE_PATH_STYLE') === 'true'}
                            onCheckedChange={(c) => updateEnv('STORAGE_S3_FORCE_PATH_STYLE', String(c))}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'env' && (
                <div className='space-y-4 animate-in fade-in'>
                  <p className='text-sm text-muted-foreground bg-secondary/20 p-3 rounded-md border border-border'>
                    Define default environment variable overrides for this template.
                  </p>

                  <div className='space-y-3'>
                    {systemTemplate?.envVars.map((envVar) => (
                      <div
                        key={envVar}
                        className='grid grid-cols-12 gap-3 items-center p-2 rounded hover:bg-secondary/10'
                      >
                        <label className='col-span-4 text-xs font-mono font-medium truncate' title={envVar}>
                          {envVar}
                        </label>
                        <div className='col-span-8'>
                          <input
                            type='text'
                            placeholder='System Default'
                            className='w-full px-3 py-1.5 text-sm rounded-md border border-input bg-background/50 focus:bg-background transition-colors'
                            value={formData.config.env?.[envVar] || ''}
                            onChange={(e) => updateEnv(envVar, e.target.value)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className='p-3 sm:p-4 border-t border-border flex justify-between items-center bg-secondary/5 rounded-b-lg flex-shrink-0'>
          <button
            type='button'
            onClick={onClose}
            className='px-4 py-2 text-sm font-medium hover:bg-secondary rounded-md transition-colors'
          >
            Cancel
          </button>

          <button
            type='submit'
            form='template-form'
            disabled={isPending}
            className='px-6 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors flex items-center gap-2'
          >
            {isPending ? (
              <>Saving...</>
            ) : (
              <>
                <Save className='w-4 h-4' />
                {isEditMode ? 'Save Template' : 'Create Template'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
