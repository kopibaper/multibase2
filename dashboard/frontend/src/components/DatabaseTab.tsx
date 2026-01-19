import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { instancesApi } from '../lib/api';
import { Database, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

interface DatabaseTabProps {
  instance: any;
}

export default function DatabaseTab({ instance }: DatabaseTabProps) {
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
      toast.success('Database configuration updated. Services restarting...');
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ['instance', instance.name, 'env'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update database configuration');
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
          <h3 className='text-xl font-semibold'>Database Settings</h3>
          <p className='text-sm text-muted-foreground'>Configure Supavisor connection pooling.</p>
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

      <div className='bg-secondary/20 p-4 rounded-lg border border-border'>
        <div className='flex items-center gap-2 border-b border-border pb-2 mb-4'>
          <Database className='w-5 h-5 text-primary' />
          <h3 className='font-semibold'>Connection Pooling (Supavisor)</h3>
        </div>
        <p className='text-sm text-muted-foreground mb-4'>Configure how clients connect to your database.</p>

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
  );
}
