import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { instancesApi } from '../lib/api';
import { Server, Zap, Loader2, Save, Globe } from 'lucide-react';
import { toast } from 'sonner';

interface ApiTabProps {
  instance: any;
}

export default function ApiTab({ instance }: ApiTabProps) {
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
      toast.success('API configuration updated. Services restarting...');
      setIsDirty(false);
      queryClient.invalidateQueries({ queryKey: ['instance', instance.name, 'env'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update API configuration');
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
          <h3 className='text-xl font-semibold'>API & Realtime Settings</h3>
          <p className='text-sm text-muted-foreground'>Configure PostgREST and Realtime limits.</p>
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

      {/* PostgREST */}
      <div className='glass-card p-4'>
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
      <div className='glass-card p-4'>
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

      {/* Connectivity */}
      <div className='glass-card p-4'>
        <div className='flex items-center gap-2 border-b border-border pb-2 mb-4'>
          <Globe className='w-5 h-5 text-primary' />
          <h3 className='font-semibold'>Connectivity & Public Access</h3>
        </div>
        <div className='grid gap-4'>
          <div className='space-y-2'>
            <label className='text-sm font-medium'>Public URL (SUPABASE_PUBLIC_URL)</label>
            <input
              type='text'
              className='w-full px-3 py-2 rounded-md border border-input bg-background'
              value={getEnv('SUPABASE_PUBLIC_URL')}
              onChange={(e) => updateEnv('SUPABASE_PUBLIC_URL', e.target.value)}
              placeholder='http://localhost:8000'
            />
            <p className='text-xs text-muted-foreground'>The core URL for your Supabase instance.</p>
          </div>
          <div className='space-y-2'>
            <label className='text-sm font-medium'>API External URL (API_EXTERNAL_URL)</label>
            <input
              type='text'
              className='w-full px-3 py-2 rounded-md border border-input bg-background'
              value={getEnv('API_EXTERNAL_URL')}
              onChange={(e) => updateEnv('API_EXTERNAL_URL', e.target.value)}
              placeholder='http://localhost:8000'
            />
            <p className='text-xs text-muted-foreground'>Used for Auth redirects and external access.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
