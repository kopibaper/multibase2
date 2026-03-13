import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { queuesApi } from '../lib/api';
import { X, Loader2, Plus, ListOrdered } from 'lucide-react';
import { toast } from 'sonner';

interface CreateQueueModalProps {
  instanceName: string;
  onClose: () => void;
  onSuccess: (queueName: string) => void;
}

export default function CreateQueueModal({ instanceName, onClose, onSuccess }: CreateQueueModalProps) {
  const [queueName, setQueueName] = useState('');

  const createMutation = useMutation({
    mutationFn: () => queuesApi.create(instanceName, queueName),
    onSuccess: () => {
      onSuccess(queueName);
    },
    onError: (error: any) => {
      toast.error('Failed to create queue', { description: error.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!queueName) {
      toast.error('Queue name is required');
      return;
    }
    createMutation.mutate();
  };

  const isValidName = /^[a-z][a-z0-9_]*$/.test(queueName);

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4'>
      <div className='bg-card border border-border rounded-lg shadow-xl w-full max-w-sm'>
        <div className='flex items-center justify-between p-4 border-b border-border'>
          <h2 className='text-lg font-semibold flex items-center gap-2'>
            <ListOrdered className='w-5 h-5 text-primary' />
            Create Queue
          </h2>
          <button onClick={onClose} className='p-1.5 hover:bg-secondary rounded-md transition-colors'>
            <X className='w-4 h-4' />
          </button>
        </div>

        <form onSubmit={handleSubmit} className='p-4 space-y-4'>
          <div className='space-y-1.5'>
            <label className='text-sm font-medium'>
              Queue Name <span className='text-destructive'>*</span>
            </label>
            <input
              type='text'
              className={`w-full px-3 py-2 rounded-md border bg-background text-sm font-mono ${
                queueName && !isValidName ? 'border-destructive' : 'border-input'
              }`}
              placeholder='my_queue'
              value={queueName}
              onChange={(e) => setQueueName(e.target.value.toLowerCase())}
              required
              autoFocus
            />
            {queueName && !isValidName ? (
              <p className='text-xs text-destructive'>
                Queue name must start with a letter and contain only lowercase letters, numbers, and underscores.
              </p>
            ) : (
              <p className='text-xs text-muted-foreground'>
                Lowercase letters, numbers, and underscores only. Must start with a letter.
              </p>
            )}
          </div>

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
              disabled={createMutation.isPending || !isValidName}
              className='flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm disabled:opacity-50'
            >
              {createMutation.isPending ? <Loader2 className='w-4 h-4 animate-spin' /> : <Plus className='w-4 h-4' />}
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
