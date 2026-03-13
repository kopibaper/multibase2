import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { webhooksApi, instancesApi } from '../lib/api';
import { X, Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

interface CreateWebhookModalProps {
  instanceName: string;
  onClose: () => void;
  onSuccess: () => void;
}

const EVENTS = ['INSERT', 'UPDATE', 'DELETE'] as const;

export default function CreateWebhookModal({ instanceName, onClose, onSuccess }: CreateWebhookModalProps) {
  const [name, setName] = useState('');
  const [tableSchema, setTableSchema] = useState('public');
  const [tableName, setTableName] = useState('');
  const [events, setEvents] = useState<string[]>(['INSERT']);
  const [url, setUrl] = useState('');
  const [method, setMethod] = useState('POST');
  const [timeoutMs, setTimeoutMs] = useState(5000);
  const [headers, setHeaders] = useState<{ key: string; value: string }[]>([]);

  // Fetch table list for the dropdown
  const { data: schemaData } = useQuery({
    queryKey: ['schema-tables', instanceName],
    queryFn: async () => {
      const res = await instancesApi.executeSQL(
        instanceName,
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
         ORDER BY table_name;`
      );
      return res.rows.map((r: any) => r.table_name as string);
    },
  });

  const createMutation = useMutation({
    mutationFn: () =>
      webhooksApi.create(instanceName, {
        name,
        tableSchema,
        tableName,
        events,
        url,
        method,
        headers: Object.fromEntries(headers.filter((h) => h.key).map((h) => [h.key, h.value])),
        timeoutMs,
      }),
    onSuccess: () => {
      toast.success('Webhook created');
      onSuccess();
    },
    onError: (error: any) => {
      toast.error('Failed to create webhook', { description: error.message });
    },
  });

  const toggleEvent = (ev: string) => {
    setEvents((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !tableName || !url || events.length === 0) {
      toast.error('Please fill in all required fields and select at least one event');
      return;
    }
    createMutation.mutate();
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4'>
      <div className='bg-card border border-border rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto'>
        {/* Header */}
        <div className='flex items-center justify-between p-4 border-b border-border'>
          <h2 className='text-lg font-semibold'>Create Webhook</h2>
          <button onClick={onClose} className='p-1.5 hover:bg-secondary rounded-md transition-colors'>
            <X className='w-4 h-4' />
          </button>
        </div>

        <form onSubmit={handleSubmit} className='p-4 space-y-4'>
          {/* Name */}
          <div className='space-y-1.5'>
            <label className='text-sm font-medium'>
              Name <span className='text-destructive'>*</span>
            </label>
            <input
              type='text'
              className='w-full px-3 py-2 rounded-md border border-input bg-background text-sm'
              placeholder='e.g. on-user-signup'
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Table */}
          <div className='grid grid-cols-3 gap-2'>
            <div className='space-y-1.5'>
              <label className='text-sm font-medium'>Schema</label>
              <input
                type='text'
                className='w-full px-3 py-2 rounded-md border border-input bg-background text-sm'
                value={tableSchema}
                onChange={(e) => setTableSchema(e.target.value)}
              />
            </div>
            <div className='col-span-2 space-y-1.5'>
              <label className='text-sm font-medium'>
                Table <span className='text-destructive'>*</span>
              </label>
              {schemaData && schemaData.length > 0 ? (
                <select
                  className='w-full px-3 py-2 rounded-md border border-input bg-background text-sm'
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  required
                >
                  <option value=''>Select table...</option>
                  {schemaData.map((t: string) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              ) : (
                <input
                  type='text'
                  className='w-full px-3 py-2 rounded-md border border-input bg-background text-sm'
                  placeholder='table_name'
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                  required
                />
              )}
            </div>
          </div>

          {/* Events */}
          <div className='space-y-1.5'>
            <label className='text-sm font-medium'>
              Events <span className='text-destructive'>*</span>
            </label>
            <div className='flex gap-2'>
              {EVENTS.map((ev) => (
                <label
                  key={ev}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md border cursor-pointer text-sm transition-colors ${
                    events.includes(ev)
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-input hover:bg-muted'
                  }`}
                >
                  <input
                    type='checkbox'
                    className='sr-only'
                    checked={events.includes(ev)}
                    onChange={() => toggleEvent(ev)}
                  />
                  {ev}
                </label>
              ))}
            </div>
          </div>

          {/* URL */}
          <div className='grid grid-cols-4 gap-2'>
            <div className='space-y-1.5'>
              <label className='text-sm font-medium'>Method</label>
              <select
                className='w-full px-3 py-2 rounded-md border border-input bg-background text-sm'
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option>POST</option>
                <option>GET</option>
              </select>
            </div>
            <div className='col-span-3 space-y-1.5'>
              <label className='text-sm font-medium'>
                Endpoint URL <span className='text-destructive'>*</span>
              </label>
              <input
                type='url'
                className='w-full px-3 py-2 rounded-md border border-input bg-background text-sm'
                placeholder='https://example.com/webhook'
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Timeout */}
          <div className='space-y-1.5'>
            <label className='text-sm font-medium'>Timeout (ms)</label>
            <input
              type='number'
              className='w-full px-3 py-2 rounded-md border border-input bg-background text-sm'
              value={timeoutMs}
              onChange={(e) => setTimeoutMs(parseInt(e.target.value, 10))}
              min={1000}
              max={30000}
              step={1000}
            />
          </div>

          {/* Custom Headers */}
          <div className='space-y-1.5'>
            <div className='flex items-center justify-between'>
              <label className='text-sm font-medium'>Custom Headers</label>
              <button
                type='button'
                onClick={() => setHeaders((prev) => [...prev, { key: '', value: '' }])}
                className='flex items-center gap-1 text-xs text-primary hover:underline'
              >
                <Plus className='w-3 h-3' />
                Add header
              </button>
            </div>
            {headers.map((h, i) => (
              <div key={i} className='flex gap-2'>
                <input
                  type='text'
                  className='flex-1 px-3 py-1.5 rounded-md border border-input bg-background text-sm'
                  placeholder='Header name'
                  value={h.key}
                  onChange={(e) =>
                    setHeaders((prev) => prev.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)))
                  }
                />
                <input
                  type='text'
                  className='flex-1 px-3 py-1.5 rounded-md border border-input bg-background text-sm'
                  placeholder='Value'
                  value={h.value}
                  onChange={(e) =>
                    setHeaders((prev) => prev.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))
                  }
                />
                <button
                  type='button'
                  onClick={() => setHeaders((prev) => prev.filter((_, j) => j !== i))}
                  className='p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-md transition-colors'
                >
                  <Trash2 className='w-4 h-4' />
                </button>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className='flex justify-end gap-2 pt-2 border-t border-border'>
            <button
              type='button'
              onClick={onClose}
              className='px-4 py-2 rounded-md hover:bg-secondary transition-colors text-sm'
            >
              Cancel
            </button>
            <button
              type='submit'
              disabled={createMutation.isPending}
              className='flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm disabled:opacity-50'
            >
              {createMutation.isPending ? <Loader2 className='w-4 h-4 animate-spin' /> : <Plus className='w-4 h-4' />}
              Create Webhook
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
