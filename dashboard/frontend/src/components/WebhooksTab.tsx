import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { webhooksApi } from '../lib/api';
import { Webhook, Plus, Trash2, RefreshCw, Loader2, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import CreateWebhookModal from './CreateWebhookModal';

interface WebhooksTabProps {
  instanceName: string;
}

export default function WebhooksTab({ instanceName }: WebhooksTabProps) {
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const {
    data,
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['webhooks', instanceName],
    queryFn: () => webhooksApi.list(instanceName),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => webhooksApi.delete(instanceName, id),
    onSuccess: () => {
      toast.success('Webhook deleted');
      queryClient.invalidateQueries({ queryKey: ['webhooks', instanceName] });
    },
    onError: (error: any) => {
      toast.error('Failed to delete webhook', { description: error.message });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: number; enabled: boolean }) =>
      webhooksApi.toggle(instanceName, id, enabled),
    onSuccess: (_, { enabled }) => {
      toast.success(`Webhook ${enabled ? 'enabled' : 'disabled'}`);
      queryClient.invalidateQueries({ queryKey: ['webhooks', instanceName] });
    },
    onError: (error: any) => {
      toast.error('Failed to toggle webhook', { description: error.message });
    },
  });

  const webhooks = data?.webhooks ?? [];

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h3 className='text-lg font-semibold flex items-center gap-2'>
            <Webhook className='w-5 h-5 text-primary' />
            Database Webhooks
          </h3>
          <p className='text-sm text-muted-foreground mt-0.5'>
            Trigger HTTP requests automatically when rows are inserted, updated, or deleted.
          </p>
        </div>
        <div className='flex gap-2'>
          <button
            onClick={() => refetch()}
            disabled={isRefetching}
            className='p-2 hover:bg-secondary rounded-md transition-colors'
            title='Refresh'
          >
            <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className='flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm'
          >
            <Plus className='w-4 h-4' />
            New Webhook
          </button>
        </div>
      </div>

      {/* pg_net notice */}
      <div className='flex items-start gap-2 rounded-md bg-amber-500/10 border border-amber-500/20 p-3'>
        <AlertTriangle className='w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5' />
        <p className='text-xs text-amber-700 dark:text-amber-400'>
          Webhooks require the <strong>pg_net</strong> Postgres extension. If pg_net is not installed,
          webhook configurations are saved but HTTP triggers will not fire.
        </p>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className='flex justify-center p-12'>
          <Loader2 className='w-6 h-6 animate-spin text-primary' />
        </div>
      ) : webhooks.length === 0 ? (
        <div className='flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-lg'>
          <Webhook className='w-10 h-10 text-muted-foreground mb-3' />
          <p className='text-sm font-medium mb-1'>No webhooks configured</p>
          <p className='text-xs text-muted-foreground mb-4'>
            Create a webhook to trigger HTTP requests on database events.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className='flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm'
          >
            <Plus className='w-4 h-4' />
            Create First Webhook
          </button>
        </div>
      ) : (
        <div className='border border-border rounded-lg overflow-hidden'>
          <table className='w-full text-sm'>
            <thead className='bg-muted/50 border-b border-border'>
              <tr>
                <th className='text-left px-4 py-3 font-medium'>Name</th>
                <th className='text-left px-4 py-3 font-medium hidden sm:table-cell'>Table</th>
                <th className='text-left px-4 py-3 font-medium hidden md:table-cell'>Events</th>
                <th className='text-left px-4 py-3 font-medium hidden lg:table-cell'>URL</th>
                <th className='text-left px-4 py-3 font-medium'>Status</th>
                <th className='text-right px-4 py-3 font-medium'>Actions</th>
              </tr>
            </thead>
            <tbody className='divide-y divide-border'>
              {webhooks.map((wh: any) => (
                <tr key={wh.id} className='hover:bg-muted/30 transition-colors'>
                  <td className='px-4 py-3 font-medium'>{wh.name}</td>
                  <td className='px-4 py-3 text-muted-foreground hidden sm:table-cell'>
                    <code className='text-xs bg-muted px-1.5 py-0.5 rounded'>
                      {wh.table_schema}.{wh.table_name}
                    </code>
                  </td>
                  <td className='px-4 py-3 hidden md:table-cell'>
                    <div className='flex gap-1 flex-wrap'>
                      {(wh.events ?? []).map((ev: string) => (
                        <span
                          key={ev}
                          className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                            ev === 'INSERT'
                              ? 'bg-green-500/15 text-green-700 dark:text-green-400'
                              : ev === 'UPDATE'
                              ? 'bg-blue-500/15 text-blue-700 dark:text-blue-400'
                              : 'bg-red-500/15 text-red-700 dark:text-red-400'
                          }`}
                        >
                          {ev}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className='px-4 py-3 hidden lg:table-cell'>
                    <span className='text-xs text-muted-foreground truncate max-w-[200px] inline-block' title={wh.url}>
                      {wh.url}
                    </span>
                  </td>
                  <td className='px-4 py-3'>
                    <button
                      onClick={() => toggleMutation.mutate({ id: wh.id, enabled: !wh.enabled })}
                      disabled={toggleMutation.isPending}
                      className='flex items-center gap-1.5 text-xs'
                    >
                      {wh.enabled ? (
                        <CheckCircle className='w-4 h-4 text-green-500' />
                      ) : (
                        <XCircle className='w-4 h-4 text-muted-foreground' />
                      )}
                      {wh.enabled ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className='px-4 py-3 text-right'>
                    <button
                      onClick={() => {
                        if (confirm(`Delete webhook "${wh.name}"?`)) {
                          deleteMutation.mutate(wh.id);
                        }
                      }}
                      disabled={deleteMutation.isPending}
                      className='p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors'
                      title='Delete'
                    >
                      <Trash2 className='w-4 h-4' />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreateModal && (
        <CreateWebhookModal
          instanceName={instanceName}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false);
            queryClient.invalidateQueries({ queryKey: ['webhooks', instanceName] });
          }}
        />
      )}
    </div>
  );
}
