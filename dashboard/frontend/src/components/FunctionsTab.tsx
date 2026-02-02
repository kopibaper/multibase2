import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { functionsApi } from '../lib/api';
import { Cloud, Plus, Save, Trash2, RefreshCw, Loader2, Code as CodeIcon, Play } from 'lucide-react';
import { toast } from 'sonner';
import CreateFunctionModal from './CreateFunctionModal';

interface FunctionsTabProps {
  instanceName: string;
}

export default function FunctionsTab({ instanceName }: FunctionsTabProps) {
  const [selectedFunction, setSelectedFunction] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Fetch functions list
  const {
    data: functionsData,
    isLoading: isLoadingFunctions,
    refetch: refetchFunctions,
  } = useQuery({
    queryKey: ['functions', instanceName],
    queryFn: () => functionsApi.list(instanceName),
  });

  // Fetch function code when selected
  const { data: functionData, isLoading: isLoadingCode } = useQuery({
    queryKey: ['function', instanceName, selectedFunction],
    queryFn: () => functionsApi.get(instanceName, selectedFunction!),
    enabled: !!selectedFunction,
  });

  // Fetch logs
  const {
    data: logsData,
    isLoading: isLoadingLogs,
    refetch: refetchLogs,
    isRefetching: isRefetchingLogs,
  } = useQuery({
    queryKey: ['function-logs', instanceName, selectedFunction],
    queryFn: () => functionsApi.getLogs(instanceName, selectedFunction!),
    enabled: !!selectedFunction,
    refetchInterval: 5000, // Auto-refresh every 5s
  });

  // Update code state when data loads
  useEffect(() => {
    if (functionData) {
      setCode(functionData.code);
      setIsDirty(false);
    }
  }, [functionData]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFunction) return;
      return functionsApi.save(instanceName, selectedFunction, code);
    },
    onSuccess: () => {
      toast.success('Function saved successfully');
      setIsDirty(false);
    },
    onError: (error: any) => {
      toast.error('Failed to save function', { description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (name: string) => {
      return functionsApi.delete(instanceName, name);
    },
    onSuccess: () => {
      toast.success('Function deleted');
      setSelectedFunction(null);
      setCode('');
      refetchFunctions();
    },
    onError: (error: any) => {
      toast.error('Failed to delete function', { description: error.message });
    },
  });

  const deployMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFunction) return;
      return functionsApi.deploy(instanceName, selectedFunction);
    },
    onSuccess: () => {
      toast.success('Function deployed (simulated)');
    },
    onError: (error: any) => {
      toast.error('Failed to deploy function', { description: error.message });
    },
  });

  const handleCreateSuccess = () => {
    refetchFunctions();
  };

  return (
    <div className='flex flex-col lg:flex-row gap-4 lg:gap-6 lg:h-[800px]'>
      {/* Sidebar: Function List */}
      <div className='w-full lg:w-1/4 glass-card flex flex-col max-h-60 lg:max-h-none'>
        <div className='p-4 border-b border-border flex items-center justify-between'>
          <h3 className='font-semibold flex items-center gap-2'>
            <Cloud className='w-4 h-4 text-primary' />
            Functions
          </h3>
          <div className='flex items-center gap-1'>
            <button
              onClick={() => refetchFunctions()}
              className='p-1.5 hover:bg-secondary rounded-md text-muted-foreground transition-colors'
            >
              <RefreshCw className='w-4 h-4' />
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className='p-1.5 hover:bg-secondary rounded-md text-primary transition-colors'
            >
              <Plus className='w-4 h-4' />
            </button>
          </div>
        </div>

        <div className='flex-1 overflow-y-auto p-2 space-y-1'>
          {isLoadingFunctions ? (
            <div className='flex justify-center p-4'>
              <Loader2 className='w-4 h-4 animate-spin text-muted-foreground' />
            </div>
          ) : functionsData?.functions.length === 0 ? (
            <div className='text-center p-4 text-sm text-muted-foreground'>No functions found</div>
          ) : (
            functionsData?.functions.map((func) => (
              <div
                key={func}
                onClick={() => {
                  if (isDirty) {
                    if (!confirm('You have unsaved changes. Discard them?')) return;
                  }
                  setSelectedFunction(func);
                }}
                className={`w-full flex items-center justify-between px-3 py-3 rounded-md text-sm transition-colors cursor-pointer border ${
                  selectedFunction === func
                    ? 'bg-primary/5 border-primary/20'
                    : 'bg-card border-transparent hover:bg-secondary/50'
                }`}
              >
                <div className='flex items-center gap-2 truncate'>
                  <CodeIcon className='w-3 h-3 text-muted-foreground' />
                  <span className='font-medium truncate'>{func}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Main Content: Editor */}
      <div className='flex-1 glass-card flex flex-col'>
        {selectedFunction ? (
          <div className='flex flex-col h-full'>
            <div className='p-3 sm:p-4 border-b border-border flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between bg-card text-card-foreground'>
              <div className='min-w-0'>
                <h3 className='font-mono font-semibold flex items-center gap-2 truncate text-sm sm:text-base'>
                  {selectedFunction}
                </h3>
                <span className='text-xs text-muted-foreground flex items-center gap-1'>
                  {isDirty && <span className='w-2 h-2 rounded-full bg-yellow-500 block'></span>}
                  {isDirty ? 'Unsaved' : 'Saved'}
                </span>
              </div>

              <div className='flex items-center gap-1 sm:gap-2'>
                <button
                  onClick={() => deleteMutation.mutate(selectedFunction)}
                  className='p-1.5 sm:px-3 sm:py-1.5 text-destructive hover:bg-destructive/10 rounded-md transition-colors text-sm'
                  title='Delete'
                >
                  <Trash2 className='w-4 h-4' />
                </button>
                <div className='h-6 w-px bg-border hidden sm:block'></div>
                <button
                  onClick={() => deployMutation.mutate()}
                  disabled={deployMutation.isPending || isDirty}
                  className='flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 text-green-600 hover:bg-green-500/10 rounded-md transition-colors text-sm disabled:opacity-50'
                  title='Deploy'
                >
                  <Play className='w-4 h-4' />
                  <span className='hidden sm:inline'>Deploy</span>
                </button>
                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending || !isDirty}
                  className='flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-1.5 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-sm disabled:opacity-50'
                  title='Save'
                >
                  {saveMutation.isPending ? <Loader2 className='w-4 h-4 animate-spin' /> : <Save className='w-4 h-4' />}
                  <span className='hidden sm:inline'>Save</span>
                </button>
              </div>
            </div>

            <div className='flex-1 relative min-h-[480px]'>
              {isLoadingCode ? (
                <div className='absolute inset-0 flex items-center justify-center'>
                  <Loader2 className='w-8 h-8 animate-spin text-primary' />
                </div>
              ) : (
                <div className='h-full flex flex-col'>
                  <textarea
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      setIsDirty(true);
                    }}
                    className='w-full flex-1 p-3 sm:p-4 font-mono text-xs sm:text-sm bg-secondary/10 resize-none focus:outline-none min-h-[480px]'
                    spellCheck={false}
                  />

                  {/* Logs Panel */}
                  <div className='min-h-[480px] border-t border-border bg-black text-white p-2 flex flex-col'>
                    <div className='flex items-center justify-between mb-2 px-2'>
                      <h4 className='text-xs font-semibold uppercase tracking-wider text-muted-foreground'>Logs</h4>
                      <button
                        onClick={() => refetchLogs()}
                        disabled={isRefetchingLogs}
                        className='p-1 hover:bg-white/10 rounded cursor-pointer disabled:opacity-50'
                        title='Refresh Logs'
                      >
                        <RefreshCw className={`w-3 h-3 ${isRefetchingLogs ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                    <div className='flex-1 overflow-y-auto font-mono text-xs px-2 pb-2'>
                      {isLoadingLogs ? (
                        <div className='text-muted-foreground'>Loading logs...</div>
                      ) : logsData?.logs && logsData.logs.length > 0 ? (
                        logsData.logs.map((log, i) => (
                          <div key={i} className='whitespace-pre-wrap border-b border-white/5 py-0.5'>
                            {log}
                          </div>
                        ))
                      ) : (
                        <div className='text-muted-foreground italic'>No logs available.</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className='flex-1 flex flex-col items-center justify-center text-muted-foreground'>
            <div className='bg-secondary/20 p-6 rounded-full mb-4'>
              <Cloud className='w-12 h-12 opacity-50' />
            </div>
            <p className='text-lg font-medium'>Select a function to edit</p>
            <p className='text-sm'>Or create a new one to get started</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className='mt-6 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors flex items-center gap-2'
            >
              <Plus className='w-4 h-4' />
              Create Function
            </button>
          </div>
        )}
      </div>

      {showCreateModal && (
        <CreateFunctionModal
          instanceName={instanceName}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateSuccess}
        />
      )}
    </div>
  );
}
