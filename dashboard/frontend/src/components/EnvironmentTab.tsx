import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { instancesApi } from '../lib/api';
import { Settings, Save, Loader2, Info, AlertTriangle, Cpu, HardDrive, Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import ResourceLimitsForm from './ResourceLimitsForm';
import { ResourceLimits, RESOURCE_PRESETS } from '../types';

interface EnvironmentTabProps {
  instance: any;
}

export default function EnvironmentTab({ instance }: EnvironmentTabProps) {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState<'env' | 'resources'>('env');
  const [showApiKey, setShowApiKey] = useState(false);

  // Fetch current environment variables
  const { data: envVars, isLoading: isLoadingEnv } = useQuery({
    queryKey: ['instance-env', instance.name],
    queryFn: () => instancesApi.getEnv(instance.name),
  });

  // Local state for editing
  const [editedEnv, setEditedEnv] = useState<Record<string, string>>({});
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [resourceLimits, setResourceLimits] = useState<ResourceLimits>(RESOURCE_PRESETS.medium);

  // Sync fetched env vars to local state
  useEffect(() => {
    if (envVars) {
      setEditedEnv(envVars);
    }
  }, [envVars]);

  // Mutation for updating env vars
  const updateEnvMutation = useMutation({
    mutationFn: (data: Record<string, string>) => instancesApi.updateEnv(instance.name, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instance-env', instance.name] });
      toast.success('Environment variables updated', {
        description: 'Restart the instance to apply changes.',
      });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update environment');
    },
  });

  // Mutation for updating resource limits
  const updateResourcesMutation = useMutation({
    mutationFn: (limits: ResourceLimits) => instancesApi.updateResources(instance.name, { resourceLimits: limits }),
    onSuccess: () => {
      toast.success('Resource limits updated', {
        description: 'Restart the instance to apply changes.',
      });
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to update resource limits');
    },
  });

  const handleEnvChange = (key: string, value: string) => {
    setEditedEnv((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddEnvVar = () => {
    if (!newKey.trim()) {
      toast.error('Variable name is required');
      return;
    }
    if (!/^[A-Z_][A-Z0-9_]*$/.test(newKey)) {
      toast.error('Variable name must be uppercase with underscores');
      return;
    }
    setEditedEnv((prev) => ({ ...prev, [newKey]: newValue }));
    setNewKey('');
    setNewValue('');
  };

  const handleRemoveEnvVar = (key: string) => {
    setEditedEnv((prev) => {
      const newEnv = { ...prev };
      delete newEnv[key];
      return newEnv;
    });
  };

  const handleSaveEnv = () => {
    updateEnvMutation.mutate(editedEnv);
  };

  const handleSaveResources = () => {
    updateResourcesMutation.mutate(resourceLimits);
  };

  // Filter sensitive variables for display
  const sensitiveKeys = ['JWT_SECRET', 'ANON_KEY', 'SERVICE_ROLE_KEY', 'POSTGRES_PASSWORD', 'DASHBOARD_PASSWORD'];

  return (
    <div className='space-y-6'>
      {/* Section Tabs */}
      <div className='flex gap-2 border-b border-border overflow-x-auto scrollbar-hide -mx-4 sm:-mx-0 px-4 sm:px-0'>
        <button
          onClick={() => setActiveSection('env')}
          className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap flex-shrink-0 ${
            activeSection === 'env'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Settings className='w-4 h-4 inline-block mr-2' />
          <span className='hidden sm:inline'>Environment Variables</span>
          <span className='sm:hidden'>Env Vars</span>
        </button>
        <button
          onClick={() => setActiveSection('resources')}
          className={`px-3 sm:px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px whitespace-nowrap flex-shrink-0 ${
            activeSection === 'resources'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Cpu className='w-4 h-4 inline-block mr-2' />
          <span className='hidden sm:inline'>Resource Limits</span>
          <span className='sm:hidden'>Resources</span>
        </button>
      </div>

      {/* Environment Variables Section */}
      {activeSection === 'env' && (
        <div className='glass-card p-6'>
          <h3 className='text-lg font-semibold text-foreground mb-4 flex items-center gap-2'>
            <Settings className='w-5 h-5 text-primary' />
            Environment Variables
          </h3>

          <div className='bg-amber-500/10 border border-amber-500/30 rounded-lg p-4 mb-6 flex gap-3 text-sm text-amber-200'>
            <AlertTriangle className='w-5 h-5 mt-0.5 shrink-0 text-amber-400' />
            <p>
              Modifying environment variables can affect instance behavior. A backup is created automatically before
              saving.
              <br />
              <span className='text-foreground font-medium mt-1 inline-block'>
                You must restart the instance to apply changes.
              </span>
            </p>
          </div>

          {isLoadingEnv ? (
            <div className='flex items-center justify-center py-8'>
              <Loader2 className='w-6 h-6 animate-spin text-primary' />
            </div>
          ) : (
            <>
              {/* Studio AI Key (OPENAI_API_KEY for Supabase Studio assistant) */}
              <div className='mb-6 p-3 sm:p-4 bg-secondary/30 rounded-lg border border-border'>
                <h4 className='text-sm font-medium mb-3 flex items-center gap-2'>
                  Studio AI
                  <span className='font-mono text-xs text-muted-foreground'>OPENAI_API_KEY</span>
                </h4>
                <div className='relative'>
                  <input
                    type={showApiKey ? 'text' : 'password'}
                    value={editedEnv['OPENAI_API_KEY'] ?? ''}
                    onChange={(e) => handleEnvChange('OPENAI_API_KEY', e.target.value)}
                    placeholder='sk-… (optional — enables AI assistant in Studio Dashboard)'
                    className='w-full px-3 py-2 pr-10 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono text-sm'
                  />
                  <button
                    type='button'
                    onClick={() => setShowApiKey(!showApiKey)}
                    className='absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors'
                  >
                    {showApiKey ? <EyeOff className='w-4 h-4' /> : <Eye className='w-4 h-4' />}
                  </button>
                </div>
              </div>

              {/* Add New Variable */}
              <div className='mb-6 p-3 sm:p-4 bg-secondary/30 rounded-lg border border-border'>
                <h4 className='text-sm font-medium mb-3'>Add New Variable</h4>
                <div className='flex flex-col sm:flex-row gap-2'>
                  <input
                    type='text'
                    value={newKey}
                    onChange={(e) => setNewKey(e.target.value.toUpperCase())}
                    placeholder='VARIABLE_NAME'
                    className='w-full sm:flex-1 px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/50 font-mono text-sm'
                  />
                  <input
                    type='text'
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    placeholder='value'
                    className='w-full sm:flex-1 px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 placeholder:text-muted-foreground/50 font-mono text-sm'
                  />
                  <button
                    onClick={handleAddEnvVar}
                    className='w-full sm:w-auto px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center justify-center gap-2'
                  >
                    <Plus className='w-4 h-4' />
                    <span className='sm:hidden'>Add Variable</span>
                  </button>
                </div>
              </div>

              {/* Existing Variables */}
              <div className='space-y-2 max-h-96 overflow-y-auto'>
                {Object.entries(editedEnv)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([key, value]) => (
                    <div
                      key={key}
                      className='flex flex-col sm:flex-row sm:items-center gap-2 p-2 sm:p-2 bg-secondary/20 rounded-lg border border-border/50 hover:border-border transition-colors'
                    >
                      <span className='font-mono text-sm text-muted-foreground sm:w-48 sm:shrink-0 truncate'>
                        {key}
                      </span>
                      <div className='flex gap-2 flex-1'>
                        <input
                          type={sensitiveKeys.includes(key) ? 'password' : 'text'}
                          value={value}
                          onChange={(e) => handleEnvChange(key, e.target.value)}
                          className='flex-1 min-w-0 px-2 py-1 border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary/50 font-mono text-sm'
                        />
                        <button
                          onClick={() => handleRemoveEnvVar(key)}
                          className='p-1 text-destructive/70 hover:text-destructive transition-colors flex-shrink-0'
                          title='Remove variable'
                        >
                          <Trash2 className='w-4 h-4' />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>

              <div className='pt-4 flex justify-end border-t border-border mt-4'>
                <button
                  onClick={handleSaveEnv}
                  disabled={updateEnvMutation.isPending}
                  className='flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg transition-colors disabled:opacity-50'
                >
                  {updateEnvMutation.isPending ? (
                    <Loader2 className='w-4 h-4 animate-spin' />
                  ) : (
                    <Save className='w-4 h-4' />
                  )}
                  Save Environment Variables
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Resource Limits Section */}
      {activeSection === 'resources' && (
        <div className='glass-card p-6'>
          <h3 className='text-lg font-semibold text-foreground mb-4 flex items-center gap-2'>
            <HardDrive className='w-5 h-5 text-primary' />
            Resource Limits
          </h3>

          <div className='bg-secondary/50 border border-border rounded-lg p-4 mb-6 flex gap-3 text-sm text-muted-foreground'>
            <Info className='w-5 h-5 mt-0.5 shrink-0 text-primary' />
            <p>
              Configure CPU and memory limits for this instance's Docker containers.
              <br />
              <span className='text-foreground font-medium mt-1 inline-block'>
                You must restart the instance to apply changes.
              </span>
            </p>
          </div>

          <ResourceLimitsForm value={resourceLimits} onChange={setResourceLimits} />

          <div className='pt-4 flex justify-end border-t border-border mt-6'>
            <button
              onClick={handleSaveResources}
              disabled={updateResourcesMutation.isPending}
              className='flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-lg transition-colors disabled:opacity-50'
            >
              {updateResourcesMutation.isPending ? (
                <Loader2 className='w-4 h-4 animate-spin' />
              ) : (
                <Save className='w-4 h-4' />
              )}
              Save Resource Limits
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
