import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { instancesApi } from '../lib/api';
import { Database, Globe, Settings, Save, Loader2, Info } from 'lucide-react';
import { Switch } from './ui/Switch';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface StorageSettingsTabProps {
  instance: any;
}

export default function StorageSettingsTab({ instance }: StorageSettingsTabProps) {
  const queryClient = useQueryClient();
  const [env, setEnv] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);

  // Fetch Env
  const { data: fetchedEnv, isLoading } = useQuery({
    queryKey: ['instance', instance.name, 'env'],
    queryFn: () => instancesApi.getEnv(instance.name),
  });

  useEffect(() => {
    if (fetchedEnv) {
      setEnv(fetchedEnv);
    }
  }, [fetchedEnv]);

  const updateMutation = useMutation({
    mutationFn: (data: Record<string, string>) => instancesApi.updateEnv(instance.name, data),
    onSuccess: () => {
      toast.success('Storage configuration updated. Services restarting...');
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ['instance', instance.name, 'env'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update storage configuration');
    },
  });

  const updateEnv = (key: string, value: string) => {
    setEnv((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const getEnv = (key: string) => env[key] || '';

  const handleSave = () => {
    updateMutation.mutate(env);
  };

  if (isLoading) {
    return (
      <div className='flex justify-center p-8'>
        <Loader2 className='w-8 h-8 animate-spin text-primary' />
      </div>
    );
  }

  return (
    <div className='space-y-8 animate-in fade-in max-w-4xl mx-auto pb-12'>
      {/* Header with Save */}
      <div className='flex items-center justify-between sticky top-0 bg-background/95 backdrop-blur z-10 py-4 border-b mb-6'>
        <div>
          <h3 className='text-xl font-semibold'>Storage Settings</h3>
          <p className='text-sm text-muted-foreground'>Configure storage backend (internal or S3).</p>
        </div>
        <button
          onClick={handleSave}
          disabled={!isDirty || updateMutation.isPending}
          className='flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50'
        >
          {updateMutation.isPending ? <Loader2 className='w-4 h-4 animate-spin' /> : <Save className='w-4 h-4' />}
          Save Changes
        </button>
      </div>

      {/* Storage Backend Selection */}
      <div className='glass-card p-6'>
        <h3 className='font-medium mb-1'>Storage Backend</h3>
        <p className='text-sm text-muted-foreground mb-4'>
          Choose how Supabase stores uploaded files. "Internal" uses the disk (Docker Volume). "External" uses
          S3-compatible services (AWS, MinIO, etc.).
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
              getEnv('STORAGE_BACKEND') === 's3' ? 'bg-primary/10 border-primary text-primary' : 'hover:bg-secondary/50'
            )}
          >
            <Globe className='w-6 h-6' />
            <span className='font-medium'>External (S3)</span>
          </button>
        </div>
      </div>

      {/* S3 Configuration */}
      {getEnv('STORAGE_BACKEND') === 's3' && (
        <div className='glass-card p-6 animate-in slide-in-from-top-2'>
          <div className='flex items-center gap-2 border-b border-border pb-2 mb-6'>
            <Settings className='w-5 h-5 text-primary' />
            <h3 className='font-semibold text-lg'>S3 Configuration</h3>
          </div>

          <div className='bg-secondary/50 border border-border rounded-lg p-4 mb-6 flex gap-3 text-sm text-muted-foreground'>
            <Info className='w-5 h-5 mt-0.5 shrink-0 text-primary' />
            <p>
              Configure your S3-compatible storage provider. Works with AWS S3, MinIO, DigitalOcean Spaces, Backblaze
              B2, and other compatible services.
            </p>
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
  );
}
