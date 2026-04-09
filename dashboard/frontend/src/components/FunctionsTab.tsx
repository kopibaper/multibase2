import { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { functionsApi } from '../lib/api';
import {
  Cloud, Plus, Save, Trash2, RefreshCw, Loader2, Code as CodeIcon,
  Play, FlaskConical, KeyRound, X, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import CreateFunctionModal from './CreateFunctionModal';
import CodeMirror from '@uiw/react-codemirror';
import { javascript } from '@codemirror/lang-javascript';
import { oneDark } from '@codemirror/theme-one-dark';

interface FunctionsTabProps {
  instanceName: string;
}

export default function FunctionsTab({ instanceName }: FunctionsTabProps) {
  const queryClient = useQueryClient();
  const [selectedFunction, setSelectedFunction] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  // Env vars state
  const [showEnv, setShowEnv] = useState(false);
  const [envEdits, setEnvEdits] = useState<Record<string, string>>({});
  const [newEnvKey, setNewEnvKey] = useState('');
  const [newEnvVal, setNewEnvVal] = useState('');

  // Test runner state
  const [showTestRunner, setShowTestRunner] = useState(false);
  const [invokeMethod, setInvokeMethod] = useState('POST');
  const [invokeHeaders, setInvokeHeaders] = useState('{}');
  const [invokeBody, setInvokeBody] = useState('{}');
  const [invokeResponse, setInvokeResponse] = useState<{ status: number; body: string } | null>(null);
  const [isInvoking, setIsInvoking] = useState(false);

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

  // Fetch env vars
  const { data: envData, isLoading: isLoadingEnv } = useQuery({
    queryKey: ['function-env', instanceName, selectedFunction],
    queryFn: () => functionsApi.getEnv(instanceName, selectedFunction!),
    enabled: !!selectedFunction && showEnv,
  });

  // Sync envEdits when data loads
  useEffect(() => {
    if (envData) setEnvEdits({ ...envData.env });
  }, [envData]);

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
    refetchInterval: 5000,
  });

  // Update code state when data loads
  useEffect(() => {
    if (functionData) {
      setCode(functionData.code);
      setIsDirty(false);
    }
  }, [functionData]);

  // Ctrl+S to save
  const saveRef = useRef<(() => void) | null>(null);
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
  saveRef.current = () => { if (isDirty) saveMutation.mutate(); };

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveRef.current?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const saveEnvMutation = useMutation({
    mutationFn: () => functionsApi.saveEnv(instanceName, selectedFunction!, envEdits),
    onSuccess: () => {
      toast.success('Environment variables saved');
      queryClient.invalidateQueries({ queryKey: ['function-env', instanceName, selectedFunction] });
    },
    onError: (error: any) => {
      toast.error('Failed to save env vars', { description: error.message });
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

  const handleInvoke = useCallback(async () => {
    if (!selectedFunction) return;
    setIsInvoking(true);
    try {
      let headers: Record<string, string> = {};
      try { headers = JSON.parse(invokeHeaders); } catch { headers = {}; }
      const result = await functionsApi.invoke(instanceName, selectedFunction, {
        method: invokeMethod,
        headers,
        body: invokeMethod !== 'GET' ? invokeBody : undefined,
      });
      setInvokeResponse({ status: result.status, body: typeof result.body === 'string' ? result.body : JSON.stringify(result.body, null, 2) });
    } catch (err: any) {
      toast.error('Invoke failed', { description: err.message });
    } finally {
      setIsInvoking(false);
    }
  }, [selectedFunction, instanceName, invokeMethod, invokeHeaders, invokeBody]);

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
                  setShowEnv(false);
                  setShowTestRunner(false);
                  setInvokeResponse(null);
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

      {/* Main Content: Editor + panels */}
      <div className='flex-1 glass-card flex flex-col overflow-hidden'>
        {selectedFunction ? (
          <div className='flex flex-col h-full'>
            {/* Toolbar */}
            <div className='p-3 sm:p-4 border-b border-border flex flex-col sm:flex-row sm:items-center gap-2 sm:justify-between bg-card text-card-foreground shrink-0'>
              <div className='min-w-0'>
                <h3 className='font-mono font-semibold flex items-center gap-2 truncate text-sm sm:text-base'>
                  {selectedFunction}
                </h3>
                <span className='text-xs text-muted-foreground flex items-center gap-1'>
                  {isDirty && <span className='w-2 h-2 rounded-full bg-yellow-500 block'></span>}
                  {isDirty ? 'Unsaved (Ctrl+S)' : 'Saved'}
                </span>
              </div>

              <div className='flex items-center gap-1 sm:gap-2'>
                <button
                  onClick={() => setShowEnv((v) => !v)}
                  className={`p-1.5 sm:px-3 sm:py-1.5 rounded-md transition-colors text-sm flex items-center gap-1 ${showEnv ? 'bg-secondary' : 'hover:bg-secondary/50'}`}
                  title='Environment Variables'
                >
                  <KeyRound className='w-4 h-4' />
                  <span className='hidden sm:inline'>Env</span>
                </button>
                <button
                  onClick={() => setShowTestRunner((v) => !v)}
                  className={`p-1.5 sm:px-3 sm:py-1.5 rounded-md transition-colors text-sm flex items-center gap-1 ${showTestRunner ? 'bg-secondary' : 'hover:bg-secondary/50'}`}
                  title='Test Runner'
                >
                  <FlaskConical className='w-4 h-4' />
                  <span className='hidden sm:inline'>Test</span>
                </button>
                <div className='h-6 w-px bg-border'></div>
                <button
                  onClick={() => deleteMutation.mutate(selectedFunction)}
                  className='p-1.5 sm:px-3 sm:py-1.5 text-destructive hover:bg-destructive/10 rounded-md transition-colors text-sm'
                  title='Delete'
                >
                  <Trash2 className='w-4 h-4' />
                </button>
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
                  title='Save (Ctrl+S)'
                >
                  {saveMutation.isPending ? <Loader2 className='w-4 h-4 animate-spin' /> : <Save className='w-4 h-4' />}
                  <span className='hidden sm:inline'>Save</span>
                </button>
              </div>
            </div>

            {/* Env Vars Panel */}
            {showEnv && (
              <div className='border-b border-border bg-secondary/10 p-4 shrink-0'>
                <div className='flex items-center justify-between mb-3'>
                  <h4 className='text-sm font-semibold flex items-center gap-2'>
                    <KeyRound className='w-4 h-4 text-primary' />
                    Environment Variables
                  </h4>
                  <button
                    onClick={() => saveEnvMutation.mutate()}
                    disabled={saveEnvMutation.isPending}
                    className='flex items-center gap-1 px-3 py-1 bg-primary text-primary-foreground rounded-md text-xs hover:bg-primary/90 disabled:opacity-50'
                  >
                    {saveEnvMutation.isPending ? <Loader2 className='w-3 h-3 animate-spin' /> : <Check className='w-3 h-3' />}
                    Save Env
                  </button>
                </div>
                {isLoadingEnv ? (
                  <div className='flex justify-center p-2'><Loader2 className='w-4 h-4 animate-spin text-muted-foreground' /></div>
                ) : (
                  <div className='space-y-2 max-h-48 overflow-y-auto'>
                    {Object.entries(envEdits).map(([key, val]) => (
                      <div key={key} className='flex items-center gap-2'>
                        <input value={key} readOnly className='flex-1 px-2 py-1 text-xs font-mono bg-secondary border border-border rounded-md opacity-60' />
                        <input
                          value={val}
                          onChange={(e) => setEnvEdits((prev) => ({ ...prev, [key]: e.target.value }))}
                          className='flex-1 px-2 py-1 text-xs font-mono bg-card border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary'
                        />
                        <button
                          onClick={() => setEnvEdits((prev) => { const c = { ...prev }; delete c[key]; return c; })}
                          className='p-1 text-destructive hover:bg-destructive/10 rounded'
                        >
                          <X className='w-3 h-3' />
                        </button>
                      </div>
                    ))}
                    <div className='flex items-center gap-2 pt-1 border-t border-border'>
                      <input
                        value={newEnvKey}
                        onChange={(e) => setNewEnvKey(e.target.value.toUpperCase())}
                        placeholder='KEY'
                        className='flex-1 px-2 py-1 text-xs font-mono bg-card border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary'
                      />
                      <input
                        value={newEnvVal}
                        onChange={(e) => setNewEnvVal(e.target.value)}
                        placeholder='value'
                        className='flex-1 px-2 py-1 text-xs font-mono bg-card border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary'
                      />
                      <button
                        onClick={() => {
                          if (!newEnvKey.trim()) return;
                          setEnvEdits((prev) => ({ ...prev, [newEnvKey.trim()]: newEnvVal }));
                          setNewEnvKey('');
                          setNewEnvVal('');
                        }}
                        className='p-1 text-primary hover:bg-primary/10 rounded'
                      >
                        <Plus className='w-4 h-4' />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Test Runner Panel */}
            {showTestRunner && (
              <div className='border-b border-border bg-secondary/10 p-4 shrink-0'>
                <h4 className='text-sm font-semibold flex items-center gap-2 mb-3'>
                  <FlaskConical className='w-4 h-4 text-primary' />
                  Test Runner
                </h4>
                <div className='flex flex-col sm:flex-row gap-2 mb-2'>
                  <select
                    value={invokeMethod}
                    onChange={(e) => setInvokeMethod(e.target.value)}
                    className='px-2 py-1 text-xs bg-card border border-border rounded-md focus:outline-none'
                  >
                    {['POST', 'GET', 'PUT', 'PATCH', 'DELETE'].map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                  <input
                    value={invokeHeaders}
                    onChange={(e) => setInvokeHeaders(e.target.value)}
                    placeholder='Headers JSON: {"Authorization":"Bearer ..."}'
                    className='flex-1 px-2 py-1 text-xs font-mono bg-card border border-border rounded-md focus:outline-none'
                  />
                  <button
                    onClick={handleInvoke}
                    disabled={isInvoking}
                    className='flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded-md text-xs hover:bg-green-700 disabled:opacity-50'
                  >
                    {isInvoking ? <Loader2 className='w-3 h-3 animate-spin' /> : <Play className='w-3 h-3' />}
                    Invoke
                  </button>
                </div>
                {invokeMethod !== 'GET' && (
                  <textarea
                    value={invokeBody}
                    onChange={(e) => setInvokeBody(e.target.value)}
                    placeholder='Request body (JSON)'
                    className='w-full px-2 py-1 text-xs font-mono bg-card border border-border rounded-md focus:outline-none resize-none h-20 mb-2'
                  />
                )}
                {invokeResponse && (
                  <div className='bg-black text-white rounded-md p-2 text-xs font-mono'>
                    <span className={`font-bold mr-2 ${invokeResponse.status < 300 ? 'text-green-400' : invokeResponse.status < 500 ? 'text-yellow-400' : 'text-red-400'}`}>
                      {invokeResponse.status}
                    </span>
                    <pre className='mt-1 whitespace-pre-wrap break-all overflow-auto max-h-40'>{invokeResponse.body}</pre>
                  </div>
                )}
              </div>
            )}

            {/* Editor area */}
            <div className='flex-1 overflow-hidden relative min-h-[300px]'>
              {isLoadingCode ? (
                <div className='absolute inset-0 flex items-center justify-center'>
                  <Loader2 className='w-8 h-8 animate-spin text-primary' />
                </div>
              ) : (
                <div className='h-full flex flex-col'>
                  <div className='flex-1 overflow-hidden' style={{ minHeight: '300px' }}>
                    <CodeMirror
                      value={code}
                      height='100%'
                      extensions={[javascript({ typescript: true })]}
                      theme={oneDark}
                      onChange={(val) => { setCode(val); setIsDirty(true); }}
                      style={{ height: '100%', fontSize: '13px' }}
                    />
                  </div>

                  {/* Logs Panel */}
                  <div className='h-48 border-t border-border bg-black text-white flex flex-col shrink-0'>
                    <div className='flex items-center justify-between px-3 py-1.5 border-b border-white/10'>
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
                    <div className='flex-1 overflow-y-auto font-mono text-xs px-3 py-2'>
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
