import { useState, useCallback, useRef, useEffect } from 'react';
import { Heading, Text, Button, Badge, Separator } from '@radix-ui/themes';
import { Play, Activity, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import McpTests from './components/McpTests';
import DatabaseTests from './components/DatabaseTests';
import StorageTests from './components/StorageTests';
import EdgeFunctionTests from './components/EdgeFunctionTests';
import RealtimeTests from './components/RealtimeTests';
import api from './lib/api';

export default function App() {
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [backendInfo, setBackendInfo] = useState<any>(null);

  // Refs to call runAll on each panel
  const mcpRef = useRef<{ runAll: () => Promise<void> }>(null);
  const dbRef = useRef<{ runAll: () => Promise<void> }>(null);
  const storageRef = useRef<{ runAll: () => Promise<void> }>(null);
  const edgeFnRef = useRef<{ runAll: () => Promise<void> }>(null);
  const realtimeRef = useRef<{ runAll: () => Promise<void> }>(null);
  const [isRunningAll, setIsRunningAll] = useState(false);

  const checkBackend = useCallback(async () => {
    setBackendStatus('checking');
    try {
      const res = await api.get('/health');
      setBackendStatus('online');
      setBackendInfo(res.data);
    } catch {
      setBackendStatus('offline');
      setBackendInfo(null);
    }
  }, []);

  useEffect(() => {
    checkBackend();
  }, [checkBackend]);

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Activity size={28} color='var(--cyan-9)' />
          <Heading size='6'>Multibase System Checker</Heading>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Badge size='2' color={backendStatus === 'online' ? 'green' : backendStatus === 'offline' ? 'red' : 'yellow'}>
            {backendStatus === 'online' ? (
              <>
                <CheckCircle2 size={12} /> Backend Online
              </>
            ) : backendStatus === 'offline' ? (
              <>
                <XCircle size={12} /> Backend Offline
              </>
            ) : (
              'Checking...'
            )}
          </Badge>
          <Button size='1' variant='soft' color='gray' onClick={checkBackend}>
            <RefreshCw size={14} />
          </Button>
        </div>
      </div>

      {/* Connection Info */}
      {backendInfo && (
        <div className='summary-bar' style={{ marginBottom: 20 }}>
          <Text size='2' color='gray'>
            <strong>Multibase API:</strong> {backendInfo.config?.multibaseApi}
          </Text>
          <Text size='2' color='gray'>
            <strong>Instance:</strong> {backendInfo.config?.instanceName}
          </Text>
          <Text size='2' color='gray'>
            <strong>Supabase:</strong> {backendInfo.config?.supabaseUrl}
          </Text>
        </div>
      )}

      {backendStatus === 'offline' && (
        <div className='summary-bar' style={{ marginBottom: 20, borderColor: 'var(--red-7)' }}>
          <XCircle size={18} color='var(--red-9)' />
          <Text size='2' color='red'>
            Backend ist nicht erreichbar. Starte den Test-Server mit: <code>cd Testprojekt/backend && npm run dev</code>
          </Text>
        </div>
      )}

      <Separator size='4' style={{ marginBottom: 20 }} />

      {/* Test Panels Grid */}
      <div className='test-grid'>
        <McpTests />
        <DatabaseTests />
        <StorageTests />
        <EdgeFunctionTests />
        <RealtimeTests />
      </div>
    </div>
  );
}
