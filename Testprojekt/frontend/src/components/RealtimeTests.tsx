import { useState, useCallback } from 'react';
import { Radio } from 'lucide-react';
import TestPanel from './TestPanel';
import api from '../lib/api';
import type { TestStep } from '../types';

const initialSteps: TestStep[] = [
  { id: 'config', name: 'Get Realtime Config', status: 'idle' },
  { id: 'stats', name: 'Get Realtime Stats', status: 'idle' },
  { id: 'subscribe', name: 'Subscribe & Broadcast Test', status: 'idle' },
  { id: 'connection-info', name: 'Get Connection Info (for Frontend)', status: 'idle' },
];

export default function RealtimeTests() {
  const [steps, setSteps] = useState<TestStep[]>(initialSteps);
  const [isRunning, setIsRunning] = useState(false);

  const updateStep = useCallback((id: string, update: Partial<TestStep>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...update } : s)));
  }, []);

  const runAll = useCallback(async () => {
    setIsRunning(true);
    setSteps(initialSteps.map((s) => ({ ...s, status: 'idle', result: undefined })));

    const tests: { id: string; method: string; url: string }[] = [
      { id: 'config', method: 'GET', url: '/tests/realtime/config' },
      { id: 'stats', method: 'GET', url: '/tests/realtime/stats' },
      { id: 'subscribe', method: 'POST', url: '/tests/realtime/subscribe-test' },
      { id: 'connection-info', method: 'GET', url: '/tests/realtime/connection-info' },
    ];

    for (const test of tests) {
      updateStep(test.id, { status: 'running' });
      try {
        const res = test.method === 'GET' ? await api.get(test.url) : await api.post(test.url);
        updateStep(test.id, {
          status: res.data?.success ? 'pass' : 'fail',
          result: res.data,
        });
      } catch (error: any) {
        updateStep(test.id, {
          status: 'fail',
          result: { success: false, test: test.id, error: error.message },
        });
      }
    }

    setIsRunning(false);
  }, [updateStep]);

  const reset = useCallback(() => {
    setSteps(initialSteps.map((s) => ({ ...s, status: 'idle', result: undefined })));
  }, []);

  return (
    <TestPanel
      title='Realtime'
      icon={<Radio size={20} color='var(--purple-9)' />}
      steps={steps}
      onRunAll={runAll}
      onReset={reset}
      isRunning={isRunning}
    />
  );
}
