import { useState, useCallback } from 'react';
import { HardDrive } from 'lucide-react';
import TestPanel from './TestPanel';
import api from '../lib/api';
import type { TestStep } from '../types';

const initialSteps: TestStep[] = [
  { id: 'create-bucket', name: 'Create Test Bucket', status: 'idle' },
  { id: 'upload', name: 'Upload Test File', status: 'idle' },
  { id: 'list', name: 'List Files in Bucket', status: 'idle' },
  { id: 'download', name: 'Download & Verify Content', status: 'idle' },
  { id: 'public-url', name: 'Get Public URL', status: 'idle' },
  { id: 'cleanup', name: 'Cleanup (Delete File + Bucket)', status: 'idle' },
];

export default function StorageTests() {
  const [steps, setSteps] = useState<TestStep[]>(initialSteps);
  const [isRunning, setIsRunning] = useState(false);

  const updateStep = useCallback((id: string, update: Partial<TestStep>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...update } : s)));
  }, []);

  const runAll = useCallback(async () => {
    setIsRunning(true);
    setSteps(initialSteps.map((s) => ({ ...s, status: 'idle', result: undefined })));

    const tests: { id: string; method: string; url: string }[] = [
      { id: 'create-bucket', method: 'POST', url: '/tests/storage/create-bucket' },
      { id: 'upload', method: 'POST', url: '/tests/storage/upload' },
      { id: 'list', method: 'GET', url: '/tests/storage/list' },
      { id: 'download', method: 'GET', url: '/tests/storage/download' },
      { id: 'public-url', method: 'GET', url: '/tests/storage/public-url' },
      { id: 'cleanup', method: 'DELETE', url: '/tests/storage/cleanup' },
    ];

    for (const test of tests) {
      updateStep(test.id, { status: 'running' });
      try {
        let res;
        switch (test.method) {
          case 'POST':
            res = await api.post(test.url);
            break;
          case 'DELETE':
            res = await api.delete(test.url);
            break;
          default:
            res = await api.get(test.url);
        }
        updateStep(test.id, {
          status: res.data?.success ? 'pass' : 'fail',
          result: res.data,
        });
        if (!res.data?.success && test.id !== 'cleanup') {
          break;
        }
      } catch (error: any) {
        updateStep(test.id, {
          status: 'fail',
          result: { success: false, test: test.id, error: error.message },
        });
        break;
      }
    }

    setIsRunning(false);
  }, [updateStep]);

  const reset = useCallback(() => {
    setSteps(initialSteps.map((s) => ({ ...s, status: 'idle', result: undefined })));
  }, []);

  return (
    <TestPanel
      title='Storage'
      icon={<HardDrive size={20} color='var(--orange-9)' />}
      steps={steps}
      onRunAll={runAll}
      onReset={reset}
      isRunning={isRunning}
    />
  );
}
