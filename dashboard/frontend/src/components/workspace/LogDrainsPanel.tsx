import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { logDrainsApi, LogDrain } from '../../lib/api';
import {
  ArrowUpFromLine, Plus, Trash2, RefreshCw, Loader2,
  CheckCircle2, XCircle, ToggleLeft, ToggleRight, FlaskConical,
} from 'lucide-react';
import { toast } from 'sonner';

const SERVICE_OPTIONS = ['db', 'auth', 'storage', 'realtime', 'rest', 'kong'];
const FORMAT_OPTIONS = ['json', 'ndjson', 'logfmt'];

interface LogDrainsPanelProps {
  instanceName: string;
}

function AddDrainModal({ instanceName, onClose, onSuccess }: { instanceName: string; onClose: () => void; onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [services, setServices] = useState<string[]>(['db', 'auth']);
  const [format, setFormat] = useState('json');

  const createMutation = useMutation({
    mutationFn: () => logDrainsApi.add(instanceName, { name, url, services, format }),
    onSuccess: () => { toast.success('Log drain created'); onSuccess(); onClose(); },
    onError: (e: any) => toast.error('Failed to create drain', { description: e.message }),
  });

  const toggleService = (s: string) => setServices((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50'>
      <div className='glass-card p-6 w-full max-w-md mx-4'>
        <h3 className='font-semibold text-lg mb-4'>Add Log Drain</h3>
        <div className='space-y-4'>
          <div>
            <label className='block text-sm text-muted-foreground mb-1'>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder='My Drain' className='w-full px-3 py-2 bg-secondary border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary' />
          </div>
          <div>
            <label className='block text-sm text-muted-foreground mb-1'>Endpoint URL</label>
            <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder='https://logs.example.com/ingest' className='w-full px-3 py-2 bg-secondary border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary' />
          </div>
          <div>
            <label className='block text-sm text-muted-foreground mb-1'>Services</label>
            <div className='flex flex-wrap gap-2'>
              {SERVICE_OPTIONS.map((s) => (
                <button key={s} onClick={() => toggleService(s)} className={`px-2 py-1 text-xs rounded-md border transition-colors ${services.includes(s) ? 'bg-primary/10 border-primary text-primary' : 'border-border text-muted-foreground hover:bg-secondary'}`}>{s}</button>
              ))}
            </div>
          </div>
          <div>
            <label className='block text-sm text-muted-foreground mb-1'>Format</label>
            <select value={format} onChange={(e) => setFormat(e.target.value)} className='w-full px-3 py-2 bg-secondary border border-border rounded-md text-sm focus:outline-none'>
              {FORMAT_OPTIONS.map((f) => <option key={f}>{f}</option>)}
            </select>
          </div>
          <div className='flex gap-3 justify-end pt-2'>
            <button onClick={onClose} className='px-4 py-2 text-sm text-muted-foreground hover:bg-secondary rounded-md transition-colors'>Cancel</button>
            <button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !name || !url} className='px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2'>
              {createMutation.isPending && <Loader2 className='w-4 h-4 animate-spin' />}
              Create Drain
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LogDrainsPanel({ instanceName }: LogDrainsPanelProps) {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['log-drains', instanceName],
    queryFn: () => logDrainsApi.list(instanceName),
    refetchInterval: 30_000,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      logDrainsApi.update(instanceName, id, { enabled }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['log-drains', instanceName] }),
    onError: (e: any) => toast.error('Failed to update drain', { description: e.message }),
  });

  const testMutation = useMutation({
    mutationFn: (id: string) => logDrainsApi.test(instanceName, id),
    onSuccess: (data) => {
      if (data.ok) toast.success('Test delivery successful');
      else toast.error('Test delivery failed', { description: data.error });
    },
    onError: (e: any) => toast.error('Test failed', { description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => logDrainsApi.remove(instanceName, id),
    onSuccess: () => {
      toast.success('Drain deleted');
      queryClient.invalidateQueries({ queryKey: ['log-drains', instanceName] });
    },
    onError: (e: any) => toast.error('Failed to delete drain', { description: e.message }),
  });

  const drains: LogDrain[] = data?.drains ?? [];

  return (
    <div className='space-y-6'>
      <div className='glass-card'>
        <div className='p-4 border-b border-border flex items-center justify-between'>
          <div>
            <h3 className='font-semibold flex items-center gap-2'>
              <ArrowUpFromLine className='w-4 h-4 text-primary' />
              Log Drains
            </h3>
            <p className='text-sm text-muted-foreground mt-0.5'>Forward container logs to external endpoints</p>
          </div>
          <div className='flex items-center gap-2'>
            <button onClick={() => refetch()} className='p-1.5 hover:bg-secondary rounded-md text-muted-foreground transition-colors'>
              <RefreshCw className='w-4 h-4' />
            </button>
            <button onClick={() => setShowAdd(true)} className='flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary/90 transition-colors'>
              <Plus className='w-4 h-4' />
              Add Drain
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className='flex justify-center p-8'><Loader2 className='w-6 h-6 animate-spin text-muted-foreground' /></div>
        ) : drains.length === 0 ? (
          <div className='flex flex-col items-center justify-center p-12 text-muted-foreground'>
            <ArrowUpFromLine className='w-10 h-10 mb-3 opacity-30' />
            <p className='font-medium'>No log drains configured</p>
            <p className='text-sm mt-1'>Forward service logs to Datadog, Loki, or any HTTP endpoint</p>
          </div>
        ) : (
          <div className='divide-y divide-border'>
            {drains.map((drain) => (
              <div key={drain.id} className='flex items-center justify-between p-4 hover:bg-secondary/20 transition-colors'>
                <div className='flex items-center gap-3 min-w-0'>
                  <div className={`p-2 rounded-lg ${drain.enabled ? 'bg-green-500/10' : 'bg-secondary'}`}>
                    <ArrowUpFromLine className={`w-4 h-4 ${drain.enabled ? 'text-green-500' : 'text-muted-foreground'}`} />
                  </div>
                  <div className='min-w-0'>
                    <div className='flex items-center gap-2'>
                      <span className='font-medium text-sm truncate'>{drain.name}</span>
                      <span className='text-xs px-1.5 py-0.5 bg-secondary rounded font-mono'>{drain.format}</span>
                      {drain.lastStatus === 'ok' && <CheckCircle2 className='w-3.5 h-3.5 text-green-500 shrink-0' />}
                      {drain.lastStatus === 'error' && <XCircle className='w-3.5 h-3.5 text-destructive shrink-0' />}
                    </div>
                    <p className='text-xs text-muted-foreground truncate'>{drain.url}</p>
                    <div className='flex gap-1 mt-1'>
                      {drain.services.map((s) => (
                        <span key={s} className='text-xs px-1 py-0.5 bg-secondary/50 rounded'>{s}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <div className='flex items-center gap-1 shrink-0 ml-3'>
                  <button
                    onClick={() => testMutation.mutate(drain.id)}
                    disabled={testMutation.isPending}
                    className='p-1.5 hover:bg-secondary rounded-md text-muted-foreground transition-colors'
                    title='Test delivery'
                  >
                    <FlaskConical className='w-4 h-4' />
                  </button>
                  <button
                    onClick={() => toggleMutation.mutate({ id: drain.id, enabled: !drain.enabled })}
                    className='p-1.5 hover:bg-secondary rounded-md transition-colors'
                    title={drain.enabled ? 'Disable' : 'Enable'}
                  >
                    {drain.enabled ? <ToggleRight className='w-4 h-4 text-green-500' /> : <ToggleLeft className='w-4 h-4 text-muted-foreground' />}
                  </button>
                  <button
                    onClick={() => { if (confirm('Delete this drain?')) deleteMutation.mutate(drain.id); }}
                    className='p-1.5 text-destructive hover:bg-destructive/10 rounded-md transition-colors'
                    title='Delete'
                  >
                    <Trash2 className='w-4 h-4' />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAdd && (
        <AddDrainModal
          instanceName={instanceName}
          onClose={() => setShowAdd(false)}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ['log-drains', instanceName] })}
        />
      )}
    </div>
  );
}
