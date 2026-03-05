import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { instancesApi } from '../lib/api';
import { X, Copy, Loader2, Info } from 'lucide-react';
import { toast } from 'sonner';

interface CloneInstanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourceName: string;
}

export default function CloneInstanceModal({ isOpen, onClose, sourceName }: CloneInstanceModalProps) {
  const queryClient = useQueryClient();
  const [newName, setNewName] = useState(`${sourceName}-clone`);
  const [copyEnv, setCopyEnv] = useState(true);

  const cloneMutation = useMutation({
    mutationFn: () => instancesApi.clone(sourceName, newName, { copyEnv }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instances'] });
      toast.success(`Instance cloned successfully`, {
        description: `${sourceName} → ${newName}`,
      });
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to clone instance');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate name
    if (!newName.trim()) {
      toast.error('Instance name is required');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(newName)) {
      toast.error('Name can only contain lowercase letters, numbers, and hyphens');
      return;
    }
    if (newName === sourceName) {
      toast.error('New name must be different from source');
      return;
    }

    cloneMutation.mutate();
  };

  if (!isOpen) return null;

  return (
    <div className='fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4'>
      <div className='glass-modal w-full max-w-md'>
        {/* Header */}
        <div className='flex items-center justify-between p-4 border-b border-border'>
          <h2 className='text-lg font-semibold flex items-center gap-2'>
            <Copy className='w-5 h-5 text-primary' />
            Clone Instance
          </h2>
          <button onClick={onClose} className='p-1 hover:bg-secondary rounded-md transition-colors'>
            <X className='w-5 h-5' />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className='p-4 space-y-4'>
          {/* Info */}
          <div className='bg-secondary/50 border border-border rounded-lg p-3 flex gap-3 text-sm text-muted-foreground'>
            <Info className='w-5 h-5 mt-0.5 shrink-0 text-primary' />
            <p>
              Cloning creates a copy of the configuration with new ports and keys.
              <br />
              <span className='font-medium text-foreground'>Database data will NOT be copied.</span>
            </p>
          </div>

          {/* Source */}
          <div>
            <label className='block text-sm font-medium mb-1 text-muted-foreground'>Source Instance</label>
            <div className='px-3 py-2 border rounded-md bg-secondary/30 text-foreground font-mono'>{sourceName}</div>
          </div>

          {/* New Name */}
          <div>
            <label className='block text-sm font-medium mb-1'>New Instance Name *</label>
            <input
              type='text'
              value={newName}
              onChange={(e) => setNewName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder='my-new-instance'
              className='w-full px-3 py-2 border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/50'
              autoFocus
            />
            <p className='text-xs text-muted-foreground mt-1'>Only lowercase letters, numbers, and hyphens allowed</p>
          </div>

          {/* Copy Env Option */}
          <div className='flex items-center gap-2'>
            <input
              type='checkbox'
              id='copyEnv'
              checked={copyEnv}
              onChange={(e) => setCopyEnv(e.target.checked)}
              className='w-4 h-4 rounded border-border'
            />
            <label htmlFor='copyEnv' className='text-sm'>
              Copy environment variables (SMTP settings, etc.)
            </label>
          </div>

          {/* Actions */}
          <div className='flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-4'>
            <button
              type='button'
              onClick={onClose}
              className='w-full sm:w-auto px-4 py-2.5 rounded-md border border-border hover:bg-secondary transition-colors text-sm'
            >
              Cancel
            </button>
            <button
              type='submit'
              disabled={cloneMutation.isPending || !newName.trim()}
              className='w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50 text-sm'
            >
              {cloneMutation.isPending ? <Loader2 className='w-4 h-4 animate-spin' /> : <Copy className='w-4 h-4' />}
              Clone Instance
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
