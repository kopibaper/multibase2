import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { instancesApi } from '../lib/api';
import { Play, Square, RotateCw, X, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { toast } from 'sonner';

interface BulkActionBarProps {
  selectedInstances: string[];
  onClearSelection: () => void;
}

type ActionType = 'start' | 'stop' | 'restart';

export default function BulkActionBar({ selectedInstances, onClearSelection }: BulkActionBarProps) {
  const [showResults, setShowResults] = useState(false);
  const [results, setResults] = useState<{ name: string; success: boolean; message: string }[]>([]);
  const queryClient = useQueryClient();

  const bulkMutation = useMutation({
    mutationFn: (action: ActionType) => instancesApi.bulk(action, selectedInstances),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['instances'] });
      setResults(data.results);
      setShowResults(true);

      const successCount = data.results.filter((r) => r.success).length;
      const failCount = data.results.filter((r) => !r.success).length;

      if (failCount === 0) {
        toast.success(data.message);
      } else if (successCount === 0) {
        toast.error(data.message);
      } else {
        toast.warning(data.message);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Bulk action failed');
    },
  });

  const handleAction = (action: ActionType) => {
    setShowResults(false);
    bulkMutation.mutate(action);
  };

  const handleClose = () => {
    setShowResults(false);
    setResults([]);
    onClearSelection();
  };

  if (selectedInstances.length === 0) {
    return null;
  }

  return (
    <div className='fixed bottom-6 left-1/2 -translate-x-1/2 z-50'>
      <div className='bg-card border border-border rounded-xl shadow-2xl p-4 flex items-center gap-4'>
        {/* Selected Count */}
        <div className='flex items-center gap-2 pr-4 border-r border-border'>
          <span className='bg-primary text-primary-foreground text-sm font-bold px-2 py-1 rounded-full'>
            {selectedInstances.length}
          </span>
          <span className='text-sm text-muted-foreground'>selected</span>
        </div>

        {/* Action Buttons */}
        <div className='flex items-center gap-2'>
          <button
            onClick={() => handleAction('start')}
            disabled={bulkMutation.isPending}
            className='flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50'
          >
            {bulkMutation.isPending && bulkMutation.variables === 'start' ? (
              <Loader2 className='w-4 h-4 animate-spin' />
            ) : (
              <Play className='w-4 h-4' />
            )}
            Start All
          </button>

          <button
            onClick={() => handleAction('stop')}
            disabled={bulkMutation.isPending}
            className='flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50'
          >
            {bulkMutation.isPending && bulkMutation.variables === 'stop' ? (
              <Loader2 className='w-4 h-4 animate-spin' />
            ) : (
              <Square className='w-4 h-4' />
            )}
            Stop All
          </button>

          <button
            onClick={() => handleAction('restart')}
            disabled={bulkMutation.isPending}
            className='flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50'
          >
            {bulkMutation.isPending && bulkMutation.variables === 'restart' ? (
              <Loader2 className='w-4 h-4 animate-spin' />
            ) : (
              <RotateCw className='w-4 h-4' />
            )}
            Restart All
          </button>
        </div>

        {/* Close Button */}
        <button
          onClick={handleClose}
          className='p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors'
        >
          <X className='w-5 h-5' />
        </button>
      </div>

      {/* Results Panel */}
      {showResults && results.length > 0 && (
        <div className='absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-card border border-border rounded-lg shadow-lg p-3 min-w-[300px] max-h-[200px] overflow-auto'>
          <div className='text-sm font-medium mb-2'>Results</div>
          <div className='space-y-1'>
            {results.map((result) => (
              <div
                key={result.name}
                className={`flex items-center gap-2 text-sm px-2 py-1 rounded ${
                  result.success ? 'bg-green-500/10 text-green-600' : 'bg-red-500/10 text-red-600'
                }`}
              >
                {result.success ? <CheckCircle className='w-4 h-4' /> : <XCircle className='w-4 h-4' />}
                <span className='font-medium'>{result.name}</span>
                <span className='text-xs opacity-70'>{result.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
