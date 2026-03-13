import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { instancesApi } from '../lib/api';
import { Server, Zap, Loader2, Save, Globe, Braces, Copy, ExternalLink, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface ApiTabProps {
  instance: any;
}

export default function ApiTab({ instance }: ApiTabProps) {
  const queryClient = useQueryClient();
  const [env, setEnv] = useState<Record<string, string>>({});
  const [isDirty, setIsDirty] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

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

  // GraphQL extension status
  const { data: graphqlStatus } = useQuery({
    queryKey: ['graphql-status', instance.name],
    queryFn: async () => {
      const result = await instancesApi.executeSQL(
        instance.name,
        `SELECT extname FROM pg_extension WHERE extname = 'pg_graphql';`
      );
      return { enabled: !result.error && result.rows.length > 0 };
    },
  });

  const copyToClipboard = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const publicUrl = getEnv('SUPABASE_PUBLIC_URL') || getEnv('API_EXTERNAL_URL') || `http://localhost:8000`;
  const graphqlUrl = `${publicUrl}/graphql/v1`;

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

      {/* GraphQL */}
      <div className='glass-card p-4'>
        <div className='flex items-center gap-2 border-b border-border pb-2 mb-4'>
          <Braces className='w-5 h-5 text-primary' />
          <h3 className='font-semibold'>GraphQL API</h3>
          <span
            className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${
              graphqlStatus?.enabled
                ? 'bg-green-500/15 text-green-600'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {graphqlStatus?.enabled ? 'Active' : 'Not installed'}
          </span>
        </div>

        {graphqlStatus?.enabled ? (
          <div className='grid gap-4'>
            <div className='space-y-2'>
              <label className='text-sm font-medium'>GraphQL Endpoint</label>
              <div className='flex items-center gap-2'>
                <code className='flex-1 px-3 py-2 rounded-md border border-input bg-muted text-sm font-mono truncate'>
                  {graphqlUrl}
                </code>
                <button
                  onClick={() => copyToClipboard(graphqlUrl, 'url')}
                  className='p-2 hover:bg-secondary rounded-md transition-colors flex-shrink-0'
                  title='Copy URL'
                >
                  {copiedKey === 'url' ? (
                    <CheckCircle className='w-4 h-4 text-green-500' />
                  ) : (
                    <Copy className='w-4 h-4' />
                  )}
                </button>
                <a
                  href={graphqlUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='p-2 hover:bg-secondary rounded-md transition-colors flex-shrink-0'
                  title='Open in new tab'
                >
                  <ExternalLink className='w-4 h-4' />
                </a>
              </div>
            </div>

            <div className='space-y-2'>
              <label className='text-sm font-medium'>Required Header</label>
              <div className='flex items-center gap-2'>
                <code className='flex-1 px-3 py-2 rounded-md border border-input bg-muted text-sm font-mono'>
                  apikey: &lt;anon-key&gt;
                </code>
                <button
                  onClick={() => copyToClipboard(`apikey: ${getEnv('ANON_KEY')}`, 'header')}
                  className='p-2 hover:bg-secondary rounded-md transition-colors flex-shrink-0'
                  title='Copy header with key'
                >
                  {copiedKey === 'header' ? (
                    <CheckCircle className='w-4 h-4 text-green-500' />
                  ) : (
                    <Copy className='w-4 h-4' />
                  )}
                </button>
              </div>
            </div>

            <div className='rounded-md bg-muted/50 border border-border p-3'>
              <p className='text-xs text-muted-foreground'>
                GraphQL is served via <strong>pg_graphql</strong>. Schemas listed in{' '}
                <strong>Exposed Schemas</strong> above (including <code>graphql_public</code>) are
                automatically reflected. Use the{' '}
                <a
                  href={graphqlUrl}
                  target='_blank'
                  rel='noopener noreferrer'
                  className='text-primary hover:underline'
                >
                  introspection endpoint
                </a>{' '}
                to explore available types and queries.
              </p>
            </div>
          </div>
        ) : (
          <div className='rounded-md bg-muted/50 border border-dashed border-border p-4 text-center'>
            <Braces className='w-8 h-8 text-muted-foreground mx-auto mb-2' />
            <p className='text-sm text-muted-foreground mb-1'>
              <strong>pg_graphql</strong> extension is not enabled on this instance.
            </p>
            <p className='text-xs text-muted-foreground'>
              Enable it via the Supabase SQL editor:{' '}
              <code className='bg-muted px-1 rounded'>CREATE EXTENSION IF NOT EXISTS pg_graphql;</code>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
