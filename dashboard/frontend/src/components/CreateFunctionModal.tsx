import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { functionsApi } from '../lib/api';
import { X, Loader2, Save, Cloud } from 'lucide-react';
import { toast } from 'sonner';

interface CreateFunctionModalProps {
  instanceName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateFunctionModal({ instanceName, onClose, onSuccess }: CreateFunctionModalProps) {
  const [functionName, setFunctionName] = useState('');
  // Default Deno/Supabase function template
  const defaultCode = `import "jsr:@supabase/functions-js/edge-runtime.d.ts";

Deno.serve(async (req) => {
  return new Response(
    JSON.stringify({ message: "Hello from Edge Function!" }),
    { headers: { "Content-Type": "application/json" } }
  );
});
`;

  const createFunctionMutation = useMutation({
    mutationFn: async () => {
      // Clean name
      let name = functionName.trim();
      if (!name.endsWith('.ts') && !name.endsWith('.js')) {
        name += '.ts';
      }
      return functionsApi.save(instanceName, name, defaultCode);
    },
    onSuccess: () => {
      toast.success(`Function "${functionName}" created`);
      onSuccess();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create function');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!functionName.trim()) {
      toast.error('Function name is required');
      return;
    }
    createFunctionMutation.mutate();
  };

  return (
    <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm'>
      <div className='bg-card w-full max-w-md rounded-lg border border-border shadow-xl'>
        <div className='flex items-center justify-between p-6 border-b border-border'>
          <h2 className='text-xl font-semibold flex items-center gap-2'>
            <Cloud className='w-5 h-5 text-primary' />
            New Edge Function
          </h2>
          <button onClick={onClose} className='text-muted-foreground hover:text-foreground'>
            <X className='w-5 h-5' />
          </button>
        </div>

        <form onSubmit={handleSubmit} className='p-6 space-y-4'>
          <div>
            <label className='block text-sm font-medium mb-2'>Function Name</label>
            <input
              type='text'
              value={functionName}
              onChange={(e) => setFunctionName(e.target.value)}
              className='w-full px-4 py-2 bg-background border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/50'
              placeholder='e.g. hello-world'
              autoFocus
            />
            <p className='text-xs text-muted-foreground mt-1'>Will be created as a .ts file</p>
          </div>

          <div className='flex justify-end pt-4'>
            <button
              type='button'
              onClick={onClose}
              className='px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground mr-2'
            >
              Cancel
            </button>
            <button
              type='submit'
              disabled={createFunctionMutation.isPending || !functionName}
              className='flex items-center gap-2 px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50'
            >
              {createFunctionMutation.isPending ? (
                <Loader2 className='w-4 h-4 animate-spin' />
              ) : (
                <Save className='w-4 h-4' />
              )}
              Create Function
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
