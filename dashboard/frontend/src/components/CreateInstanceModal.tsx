import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Plus, Globe, Laptop } from 'lucide-react';
import { useCreateInstance } from '../hooks/useInstances';
import { CreateInstanceRequest, InstanceTemplate, ResourceLimits, RESOURCE_PRESETS } from '../types';
import { toast } from 'sonner';
import { templatesApi, settingsApi } from '../lib/api';
import { useQuery } from '@tanstack/react-query';
import { cn } from '../lib/utils';
import ResourceLimitsForm from './ResourceLimitsForm';

interface CreateInstanceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTemplate?: InstanceTemplate | null;
}

interface FormData extends Omit<CreateInstanceRequest, 'basePort' | 'resourceLimits'> {
  basePort: string | number | undefined;
  corsOriginsList: string; // Comma-separated list for UI
  templateId?: number;
  resourceLimits: ResourceLimits;
}

const initialFormData: FormData = {
  name: '',
  deploymentType: 'localhost', // Default to localhost
  basePort: undefined,
  domain: '',
  protocol: 'https', // Default HTTPS for cloud
  corsOriginsList: '',
  templateId: undefined,
  resourceLimits: RESOURCE_PRESETS.medium, // Default to medium preset
};

export default function CreateInstanceModal({ open, onOpenChange, initialTemplate }: CreateInstanceModalProps) {
  const navigate = useNavigate();
  const createInstance = useCreateInstance();
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // ROOT_DOMAIN: 2nd-level base domain for instance subdomains (e.g. tyto-design.de)
  // Prefer explicit VITE_ROOT_DOMAIN; fall back to stripping the leftmost label from VITE_API_URL hostname.
  const derivedDomain = (() => {
    if (import.meta.env.VITE_ROOT_DOMAIN) return import.meta.env.VITE_ROOT_DOMAIN as string;
    try {
      const hostname = new URL(import.meta.env.VITE_API_URL || 'http://localhost:3001').hostname;
      const parts = hostname.split('.');
      return parts.length >= 3 ? parts.slice(-2).join('.') : hostname;
    } catch {
      return 'localhost';
    }
  })();

  const { data: templatesData } = useQuery({
    queryKey: ['templates'],
    queryFn: templatesApi.list,
  });
  const templates = templatesData?.templates || [];

  // Fetch system settings for CORS defaults
  const { data: systemSettings } = useQuery({
    queryKey: ['systemSettings'],
    queryFn: settingsApi.getSystem,
    enabled: open,
  });

  // Pre-fill form when initialTemplate is provided
  useEffect(() => {
    if (open && initialTemplate) {
      const config =
        typeof initialTemplate.config === 'string' ? JSON.parse(initialTemplate.config) : initialTemplate.config;

      setFormData((prev) => ({
        ...prev,
        templateId: initialTemplate.id,
        // Pre-fill fields if they exist in config
        deploymentType: config.deploymentType || prev.deploymentType,
        basePort: config.basePort || prev.basePort,
        domain: config.domain || prev.domain,
        protocol: config.protocol || prev.protocol,
        corsOriginsList: config.corsOrigins ? config.corsOrigins.join(', ') : prev.corsOriginsList,
      }));
      toast.info(`Loaded template: ${initialTemplate.name}`);
    } else if (!open) {
      setFormData({
        ...initialFormData,
        domain: derivedDomain !== 'localhost' ? derivedDomain : '',
        corsOriginsList: systemSettings?.cors || '',
      });
      setErrors({});
    }
  }, [open, initialTemplate]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    // Validate name
    if (!formData.name.trim()) {
      newErrors.name = 'Instance name is required';
    } else if (!/^[a-zA-Z0-9-_]+$/.test(formData.name)) {
      newErrors.name = 'Name can only contain letters, numbers, hyphens, and underscores';
    } else if (formData.name.length < 3) {
      newErrors.name = 'Name must be at least 3 characters';
    } else if (formData.name.length > 50) {
      newErrors.name = 'Name must be less than 50 characters';
    }

    // Validate cloud domain
    if (formData.deploymentType === 'cloud') {
      if (!formData.domain || !formData.domain.trim()) {
        newErrors.domain = 'Domain is required for cloud deployment';
      } else if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(formData.domain)) {
        newErrors.domain = 'Invalid domain format';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    const requestData: CreateInstanceRequest = {
      name: formData.name.trim(),
      deploymentType: formData.deploymentType,
      ...(formData.basePort && { basePort: Number(formData.basePort) }),
      ...(formData.domain && { domain: formData.domain.trim() }),
      ...(formData.protocol && { protocol: formData.protocol }),
      ...(formData.templateId && { templateId: Number(formData.templateId) }),
    };

    if (formData.corsOriginsList.trim()) {
      requestData.corsOrigins = formData.corsOriginsList
        .split(',')
        .map((o) => o.trim())
        .filter((o) => o.length > 0);
    }

    // Add env overrides for cloud deployment
    // domain = ROOT_DOMAIN (2nd-level) so wildcard cert covers the subdomain
    if (formData.deploymentType === 'cloud' && formData.domain && formData.name) {
      const sanitizedName = formData.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
      requestData.env = {
        SUPABASE_PUBLIC_URL: `https://${sanitizedName}.${formData.domain}`,
        API_EXTERNAL_URL: `https://${sanitizedName}-api.${formData.domain}`,
      };
    }

    // Add resource limits
    if (formData.resourceLimits && (formData.resourceLimits.cpus || formData.resourceLimits.memory)) {
      requestData.resourceLimits = formData.resourceLimits;
    }

    try {
      await createInstance.mutateAsync(requestData);
      toast.success('Instance created successfully!', {
        description: `${formData.name} is being initialized.`,
      });
      onOpenChange(false);
      navigate(`/instances/${formData.name}`);
    } catch (error: any) {
      toast.error('Failed to create instance', {
        description: error.message || 'An unexpected error occurred',
      });
    }
  };

  const isLocal = formData.deploymentType === 'localhost';

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className='fixed inset-0 bg-black/70 backdrop-blur-sm z-50' />
        <Dialog.Content className='fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 glass-modal w-full max-w-3xl max-h-[90vh] overflow-y-auto z-50 p-0'>
          {/* Header */}
          <div className='flex items-center justify-between p-6 border-b border-border'>
            <div>
              <Dialog.Title className='text-2xl font-bold text-foreground flex items-center gap-2'>
                <Plus className='w-6 h-6 text-primary' />
                Create New Instance
              </Dialog.Title>
              <Dialog.Description className='text-muted-foreground mt-1'>
                Configure your new Supabase instance deployment.
              </Dialog.Description>
            </div>
            <Dialog.Close className='text-muted-foreground hover:text-foreground p-2 hover:bg-secondary rounded-full transition-colors'>
              <X className='w-5 h-5' />
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className='flex flex-col md:flex-row'>
            {/* Left Column: Core Settings */}
            <div className='flex-1 p-6 space-y-6 border-r border-border'>
              <div className='space-y-4'>
                <h3 className='font-semibold text-lg flex items-center gap-2'>
                  <div className='w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm'>
                    1
                  </div>
                  Deployment Mode
                </h3>

                {/* Deployment Type Toggle */}
                <div className='flex p-1 bg-secondary rounded-lg'>
                  <button
                    type='button'
                    onClick={() => setFormData((prev) => ({ ...prev, deploymentType: 'localhost' }))}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all',
                      isLocal ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Laptop className='w-4 h-4' />
                    Localhost
                  </button>
                  <button
                    type='button'
                    onClick={() => setFormData((prev) => ({ ...prev, deploymentType: 'cloud' }))}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 py-2 text-sm font-medium rounded-md transition-all',
                      !isLocal ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Globe className='w-4 h-4' />
                    Cloud / VPS
                  </button>
                </div>

                <div className='text-sm text-muted-foreground bg-secondary/30 p-3 rounded-md border border-border'>
                  {isLocal
                    ? 'Best for local development. Your instance will be accessible at http://localhost:[port].'
                    : 'For production deployments on a VPS. Requires a valid domain name configured in your DNS.'}
                </div>
              </div>

              <div className='space-y-4 pt-4'>
                <h3 className='font-semibold text-lg flex items-center gap-2'>
                  <div className='w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm'>
                    2
                  </div>
                  Instance Config
                </h3>

                <div>
                  <label className='block text-sm font-medium mb-1'>
                    Instance Name <span className='text-destructive'>*</span>
                  </label>
                  <input
                    type='text'
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder='my-project'
                    className={cn(
                      'w-full px-3 py-2 border rounded-md bg-input focus:ring-2 focus:ring-primary focus:outline-none',
                      errors.name ? 'border-destructive' : 'border-border'
                    )}
                  />
                  {errors.name && <p className='text-destructive text-xs mt-1'>{errors.name}</p>}
                </div>

                {/* Cloud Domain Input */}
                {!isLocal && (
                  <div className='animate-in fade-in slide-in-from-top-2'>
                    <label className='block text-sm font-medium mb-1'>
                      Domain <span className='text-destructive'>*</span>
                    </label>
                    <div className='flex'>
                      <span className='inline-flex items-center px-3 rounded-l-md border border-r-0 border-border bg-secondary text-muted-foreground text-sm'>
                        https://
                      </span>
                      <input
                        type='text'
                        value={formData.domain}
                        onChange={(e) => setFormData((prev) => ({ ...prev, domain: e.target.value }))}
                        placeholder='api.example.com'
                        className={cn(
                          'w-full px-3 py-2 border rounded-r-md bg-input focus:ring-2 focus:ring-primary focus:outline-none',
                          errors.domain ? 'border-destructive' : 'border-border'
                        )}
                      />
                    </div>
                    {errors.domain && <p className='text-destructive text-xs mt-1'>{errors.domain}</p>}
                  </div>
                )}

                {/* Template Selection */}
                {templates.length > 0 && (
                  <div>
                    <label className='block text-sm font-medium mb-1'>Template (Optional)</label>
                    <select
                      value={formData.templateId || ''}
                      onChange={(e) => {
                        const t = templates.find((t) => t.id === Number(e.target.value));
                        if (t) {
                          const config = typeof t.config === 'string' ? JSON.parse(t.config) : t.config;
                          setFormData((p) => ({
                            ...p,
                            templateId: t.id,
                            deploymentType: config.deploymentType || p.deploymentType,
                            basePort: config.basePort || p.basePort,
                            domain: config.domain || p.domain,
                            protocol: config.protocol || p.protocol,
                            corsOriginsList: config.corsOrigins ? config.corsOrigins.join(', ') : p.corsOriginsList,
                          }));
                          toast.info(`Loaded template: ${t.name}`);
                        } else {
                          setFormData((p) => ({ ...p, templateId: undefined }));
                        }
                      }}
                      className='w-full px-3 py-2 border border-border rounded-md bg-input'
                    >
                      <option value=''>-- None --</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Advanced & Preview */}
            <div className='flex-1 p-6 space-y-6 bg-secondary/5'>
              <div className='space-y-4'>
                <h3 className='font-semibold text-lg flex items-center gap-2'>
                  <div className='w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-sm'>
                    3
                  </div>
                  Advanced Setup
                </h3>

                <div>
                  <label className='block text-sm font-medium mb-1'>Base Port (Optional)</label>
                  <input
                    type='number'
                    value={formData.basePort || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, basePort: e.target.value }))}
                    placeholder='Auto-assigned'
                    className='w-full px-3 py-2 border border-border rounded-md bg-input'
                  />
                  <p className='text-xs text-muted-foreground mt-1'>If empty, we'll find a free port automatically.</p>
                </div>

                <div>
                  <label className='block text-sm font-medium mb-1'>CORS Origins</label>
                  <input
                    type='text'
                    value={formData.corsOriginsList}
                    onChange={(e) => setFormData((prev) => ({ ...prev, corsOriginsList: e.target.value }))}
                    placeholder='https://frontend.com, http://localhost:3000'
                    className='w-full px-3 py-2 border border-border rounded-md bg-input'
                  />
                  <p className='text-xs text-muted-foreground mt-1'>Comma-separated allowed origins.</p>
                </div>

                {/* Resource Limits */}
                <div className='pt-4 mt-4 border-t border-border'>
                  <ResourceLimitsForm
                    value={formData.resourceLimits}
                    onChange={(limits) => setFormData((prev) => ({ ...prev, resourceLimits: limits }))}
                  />
                </div>
              </div>

              {/* Live Preview Card */}
              <div className='mt-8 pt-6 border-t border-border'>
                <h4 className='text-sm font-semibold mb-3'>Live Preview</h4>
                <div className='bg-card border border-border p-4 rounded-lg shadow-sm space-y-2'>
                  <div className='flex justify-between items-center text-sm'>
                    <span className='text-muted-foreground'>Studio URL:</span>
                    <code className='bg-secondary px-2 py-0.5 rounded text-primary font-mono'>
                      {isLocal
                        ? `http://localhost:${formData.basePort || '54323'}`
                        : `https://${formData.name}.${formData.domain || 'example.com'}`}
                    </code>
                  </div>
                  <div className='flex justify-between items-center text-sm'>
                    <span className='text-muted-foreground'>API URL:</span>
                    <code className='bg-secondary px-2 py-0.5 rounded text-foreground font-mono'>
                      {isLocal
                        ? `http://localhost:${formData.basePort || '54323'}/api`
                        : `https://${formData.name}.${formData.domain || 'example.com'}/api`}
                    </code>
                  </div>
                </div>
              </div>

              <div className='pt-6 flex gap-3 justify-end'>
                <button
                  type='button'
                  onClick={() => onOpenChange(false)}
                  className='px-4 py-2 border border-border rounded-md hover:bg-secondary'
                >
                  Cancel
                </button>
                <button
                  type='submit'
                  disabled={createInstance.isPending}
                  className='px-6 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2'
                >
                  {createInstance.isPending && (
                    <div className='w-4 h-4 border-2 border-white/30 border-t-white animate-spin rounded-full' />
                  )}
                  Deploy Instance
                </button>
              </div>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
