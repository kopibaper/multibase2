import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  X,
  Save,
  Layers,
  Box,
  Settings,
  Lock,
  Mail,
  Shield,
  Globe,
  Github,
  Facebook,
  Twitter,
  Disc,
} from 'lucide-react';
import { templatesApi } from '../lib/api';
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

  const [activeTab, setActiveTab] = useState<'general' | 'deployment' | 'services' | 'auth' | 'env'>('general');
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
    { id: 'general', label: 'General Info', icon: Layers },
    { id: 'deployment', label: 'Deployment', icon: () => <Settings className='w-4 h-4' /> },
    { id: 'services', label: 'Services', icon: Box },
    { id: 'auth', label: 'Authentication', icon: Lock },
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
                        <div className='p-4 grid grid-cols-2 gap-4 animate-in slide-in-from-top-2'>
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
