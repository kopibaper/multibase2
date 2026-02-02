import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { storageApi } from '../lib/api';
import { X, Loader2, Database } from 'lucide-react';
import { toast } from 'sonner';

interface CreateBucketModalProps {
  instanceName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateBucketModal({ instanceName, onClose, onSuccess }: CreateBucketModalProps) {
  const [bucketName, setBucketName] = useState('');
  const [isPublic, setIsPublic] = useState(false);

  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async () => {
      return storageApi.createBucket(instanceName, bucketName, isPublic);
    },
    onSuccess: () => {
      toast.success(`Bucket "${bucketName}" created successfully`);
      queryClient.invalidateQueries({ queryKey: ['storage-buckets', instanceName] });
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast.error('Failed to create bucket', { description: error.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bucketName.trim()) return;
    createMutation.mutate();
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm'>
      <div className='glass-modal w-full max-w-md flex flex-col'>
        <div className='flex items-center justify-between p-4 border-b border-border'>
          <h2 className='text-lg font-semibold flex items-center gap-2'>
            <Database className='w-5 h-5 text-primary' />
            Create Bucket
          </h2>
          <button onClick={onClose} className='text-muted-foreground hover:text-foreground'>
            <X className='w-5 h-5' />
          </button>
        </div>

        <form onSubmit={handleSubmit} className='p-6 space-y-4'>
          <div className='space-y-2'>
            <label htmlFor='name' className='text-sm font-medium'>
              Bucket Name
            </label>
            <input
              id='name'
              type='text'
              value={bucketName}
              onChange={(e) => setBucketName(e.target.value)}
              placeholder='e.g., avatars'
              className='w-full px-3 py-2 bg-secondary/50 border border-input rounded-md focus:outline-none focus:ring-2 focus:ring-primary/50'
              autoFocus
            />
            <p className='text-xs text-muted-foreground'>
              Allowed characters: lowercase letters, numbers, and hyphens.
            </p>
          </div>

          <div className='flex items-center gap-2'>
            <input
              type='checkbox'
              id='isPublic'
              checked={isPublic}
              onChange={(e) => setIsPublic(e.target.checked)}
              className='w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary'
            />
            <label htmlFor='isPublic' className='text-sm cursor-pointer select-none'>
              Public Bucket
            </label>
          </div>
          {isPublic && (
            <p className='text-xs text-yellow-500'>⚠️ Anyone with the URL can access objects in this bucket.</p>
          )}

          <div className='flex justify-end gap-3 pt-4'>
            <button
              type='button'
              onClick={onClose}
              className='px-4 py-2 text-sm font-medium hover:bg-secondary rounded-md transition-colors'
            >
              Cancel
            </button>
            <button
              type='submit'
              disabled={!bucketName.trim() || createMutation.isPending}
              className='px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2'
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className='w-4 h-4 animate-spin' />
                  Creating...
                </>
              ) : (
                'Create Bucket'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
