import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { replicasApi, ReadReplica } from '../../lib/api';
import {
  GitBranch, Plus, Trash2, RefreshCw, Loader2,
  CheckCircle2, XCircle, Clock, Activity,
} from 'lucide-react';
import { toast } from 'sonner';

interface ReplicasPanelProps {
  instanceName: string;
}

function AddReplicaModal({ instanceName, onClose, onSuccess }: { instanceName: string; onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  const createMutation = useMutation({
    mutationFn: () => replicasApi.add(instanceName, { name, url }),
    onSuccess: () => { toast.success('Read replica added'); onSuccess(); onClose(); },
    onError: (e: any) => toast.error('Failed to add replica', { description: e.message }),
  });

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'>
      <div className='glass-card p-6 w-full max-w-md mx-4'>
        <h3 className='font-semibold text-lg mb-4'>Add Read Replica</h3>
        <p className='text-sm text-muted-foreground mb-4'>Connect an external PostgreSQL read replica to distribute query load.</p>
        <div className='space-y-4'>
          <div>
            <label className='block text-sm text-muted-foreground mb-1'>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder='replica-us-east' className='w-full px-3 py-2 bg-secondary border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary' />
          </div>
          <div>
            <label className='block text-sm text-muted-foreground mb-1'>Connection URL</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder='postgresql://user:pass@host:5432/db' className='w-full px-3 py-2 bg-secondary border border-border rounded-md text-sm font-mono focus:outline-none focus:ring-1 focus:ring-primary' />
            <p className='text-xs text-muted-foreground mt-1'>postgresql:// connection string for the replica</p>
          </div>
          <div className='flex gap-3 justify-end pt-2'>
            <button onClick={onClose} className='px-4 py-2 text-sm text-muted-foreground hover:bg-secondary rounded-md transition-colors'>Cancel</button>
            <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !name || !url} className='px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2'>
              {createMutation.isPending && <Loader2 className='w-4 h-4 animate-spin' />}
              Add Replica
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; icon: React.ReactNode; cls: string }> = {
    active:       { label: 'Active', icon: <CheckCircle2 className='w-3.5 h-3.5' />, cls: 'text-green-600 bg-green-500/10' },
    provisioning: { label: 'Provisioning', icon: <Clock className='w-3.5 h-3.5' />, cls: 'text-yellow-600 bg-yellow-500/10' },
    syncing:      { label: 'Syncing', icon: <Activity className='w-3.5 h-3.5' />, cls: 'text-blue-600 bg-blue-500/10' },
    error:        { label: 'Error', icon: <XCircle className='w-3.5 h-3.5' />, cls: 'text-destructive bg-destructive/10' },
  };
  const config = map[status] ?? map['error'];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium ${config.cls}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

export default function ReplicasPanel({ instanceName }: ReplicasPanelProps) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['replicas', instanceName],
    queryFn: () => replicasApi.list(instanceName),
    refetchInterval: 60_000,
  });

  const checkStatusMutation = useMutation({
    mutationFn: (id: string) => replicasApi.checkStatus(instanceName, id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['replicas', instanceName] }),
    onError: (e: any) => toast.error('Status check failed', { description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => replicasApi.remove(instanceName, id),
    onSuccess: () => {
      toast.success('Replica removed');
      queryClient.invalidateQueries({ queryKey: ['replicas', instanceName] });
    },
    onError: (e: any) => toast.error('Failed to remove replica', { description: e.message }),
  });

  const replicas: ReadReplica[] = data?.replicas ?? [];

  return (
    <div className='space-y-6'>
      <div className='glass-card'>
        <div className='p-4 border-b border-border flex items-center justify-between'>
          <div>
            <h3 className='font-semibold flex items-center gap-2'>
              <GitBranch className='w-4 h-4 text-primary' />
              Read Replicas
            </h3>
            <p className='text-sm text-muted-foreground mt-0.5'>External PostgreSQL read replicas for load distribution</p>
          </div>
          <div className='flex items-center gap-2'>
            <button onClick={() => refetch()} className='p-1.5 hover:bg-secondary rounded-md text-muted-foreground transition-colors'>
              <RefreshCw className='w-4 h-4' />
            </button>
            <button onClick={() => setShowAdd(true)} className='flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary/90 transition-colors'>
              <Plus className='w-4 h-4' />
              Add Replica
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className='flex justify-center p-8'><Loader2 className='w-6 h-6 animate-spin text-muted-foreground' /></div>
        ) : replicas.length === 0 ? (
          <div className='flex flex-col items-center justify-center p-12 text-muted-foreground'>
            <GitBranch className='w-10 h-10 mb-3 opacity-30' />
            <p className='font-medium'>No read replicas configured</p>
            <p className='text-sm mt-1'>Add an external PostgreSQL replica to scale reads</p>
          </div>
        ) : (
          <div className='divide-y divide-border'>
            {replicas.map((replica) => (
              <div key={replica.id} className='flex items-center justify-between p-4 hover:bg-secondary/20 transition-colors'>
                <div className='flex items-center gap-3 min-w-0'>
                  <div className='p-2 rounded-lg bg-primary/10'>
                    <GitBranch className='w-4 h-4 text-primary' />
                  </div>
                  <div className='min-w-0'>
                    <div className='flex items-center gap-2 flex-wrap'>
                      <span className='font-medium text-sm'>{replica.name}</span>
                      <StatusBadge status={replica.status} />
                      {replica.lagBytes !== undefined && replica.lagBytes !== null && (
                        <span className='text-xs text-muted-foreground'>
                          {replica.lagBytes === 0 ? 'No lag' : `${(replica.lagBytes / 1024).toFixed(1)} KB lag`}
                        </span>
                      )}
                    </div>
                    <p className='text-xs text-muted-foreground font-mono truncate mt-0.5'>{replica.url.replace(/:[^@]+@/, ':***@')}</p>
                    <p className='text-xs text-muted-foreground'>Added {new Date(replica.createdAt).toLocaleDateString()}</p>
                  </div>
                </div>
                <div className='flex items-center gap-1 shrink-0 ml-3'>
                  <button
                    onClick={() => checkStatusMutation.mutate(replica.id)}
                    disabled={checkStatusMutation.isPending}
                    className='p-1.5 hover:bg-secondary rounded-md text-muted-foreground transition-colors'
                    title='Check status'
                  >
                    {checkStatusMutation.isPending ? <Loader2 className='w-4 h-4 animate-spin' /> : <Activity className='w-4 h-4' />}
                  </button>
                  <button
                    onClick={() => { if (confirm('Remove this replica?')) deleteMutation.mutate(replica.id); }}
                    className='p-1.5 text-destructive hover:bg-destructive/10 rounded-md transition-colors'
                    title='Remove'
                  >
                    <Trash2 className='w-4 h-4' />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info card */}
      <div className='glass-card p-4'>
        <h4 className='text-sm font-semibold mb-2 flex items-center gap-2'>
          <GitBranch className='w-4 h-4 text-muted-foreground' />
          How to set up a read replica
        </h4>
        <ol className='text-sm text-muted-foreground space-y-1 list-decimal list-inside'>
          <li>Create a PostgreSQL replica that replicates from this instance's primary DB</li>
          <li>Ensure the replica has network access to this dashboard</li>
          <li>Add the connection URL above — credentials are stored securely</li>
          <li>Configure your application to route SELECT queries to the replica</li>
        </ol>
      </div>

      {showAdd && (
        <AddReplicaModal
          instanceName={instanceName}
          onClose={() => setShowAdd(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['replicas', instanceName] })}
        />
      )}
    </div>
  );
}
