import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { storageApi } from '../lib/api';
import { Folder, Loader2, X } from 'lucide-react';
import { toast } from 'sonner';

interface CreateFolderModalProps {
  instanceName: string;
  bucketId: string;
  currentPath: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateFolderModal({
  instanceName,
  bucketId,
  currentPath,
  onClose,
  onSuccess,
}: CreateFolderModalProps) {
  const [folderName, setFolderName] = useState('');

  const createFolderMutation = useMutation({
    mutationFn: async () => {
      // Create an empty placeholder file to simulate a folder
      // Convention: folder/.emptyFolderPlaceholder
      const fullPath = currentPath
        ? `${currentPath}/${folderName}/.emptyFolderPlaceholder`
        : `${folderName}/.emptyFolderPlaceholder`;

      const file = new File([''], '.emptyFolderPlaceholder', { type: 'text/plain' });

      return storageApi.uploadFile(instanceName, bucketId, fullPath, file);
    },
    onSuccess: () => {
      toast.success('Folder created');
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast.error('Failed to create folder', { description: error.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;
    createFolderMutation.mutate();
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm'>
      <div className='bg-card w-full max-w-md rounded-lg border border-border shadow-xl p-6'>
        <div className='flex items-center justify-between mb-4'>
          <h3 className='text-lg font-semibold flex items-center gap-2'>
            <Folder className='w-5 h-5 text-primary' />
            New Folder
          </h3>
          <button onClick={onClose} className='text-muted-foreground hover:text-foreground'>
            <X className='w-5 h-5' />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className='mb-4'>
            <label className='block text-sm font-medium mb-1'>Folder Name</label>
            <input
              type='text'
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              className='w-full px-3 py-2 bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary'
              placeholder='my-folder'
              autoFocus
            />
          </div>

          <div className='flex justify-end gap-2'>
            <button
              type='button'
              onClick={onClose}
              className='px-4 py-2 text-sm text-muted-foreground hover:text-foreground'
            >
              Cancel
            </button>
            <button
              type='submit'
              disabled={!folderName.trim() || createFolderMutation.isPending}
              className='px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2'
            >
              {createFolderMutation.isPending && <Loader2 className='w-4 h-4 animate-spin' />}
              Create Folder
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
