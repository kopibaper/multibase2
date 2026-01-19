import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { X, Save, Layers, Box, Settings } from 'lucide-react';
import { templatesApi } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import { InstanceTemplate } from '../types';
import { toast } from 'sonner';
import { Switch } from './ui/Switch';
import { cn } from '../lib/utils';

interface TemplateFormModalProps {
  isOpen: boolean;
  template?: InstanceTemplate | null; // If provided, we're in Edit mode
  onClose: () => void;
  onSuccess: () => void;
}

export default function TemplateFormModal({ isOpen, template, onClose, onSuccess }: TemplateFormModalProps) {
  const { user } = useAuth();
  const isEditMode = !!template;

  const [activeTab, setActiveTab] = useState<'general' | 'deployment' | 'services' | 'env'>('general');
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
    setFormData({
      ...formData,
      config: {
        ...formData.config,
        env: { ...formData.config.env, [key]: value },
      },
    });
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  if (!isOpen) return null;

  const tabs = [
    { id: 'general', label: 'General Info', icon: Layers },
    { id: 'deployment', label: 'Deployment', icon: (settings) => <Settings className='w-4 h-4' /> },
    { id: 'services', label: 'Services', icon: Box },
    { id: 'env', label: 'Environment', icon: Settings },
  ] as const;

  return (
    <div className='fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4'>
      {/* Increased max-width to 4xl */}
      <div className='bg-card border border-border rounded-lg shadow-lg w-full max-w-4xl flex flex-col max-h-[90vh]'>
        {/* Header */}
        <div className='flex items-center justify-between p-6 border-b border-border'>
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

        <div className='flex flex-1 overflow-hidden'>
          {/* Sidebar Tabs */}
          <div className='w-48 border-r border-border bg-secondary/10 flex flex-col'>
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
          <div className='flex-1 p-6 overflow-y-auto bg-card'>
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
        <div className='p-4 border-t border-border flex justify-between items-center bg-secondary/5 rounded-b-lg'>
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
