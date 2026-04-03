import { useState, useCallback } from 'react';
import { Zap } from 'lucide-react';
import TestPanel from './TestPanel';
import api from '../lib/api';
import type { TestStep } from '../types';

const initialSteps: TestStep[] = [
  { id: 'list', name: 'List Edge Functions', status: 'idle' },
  { id: 'invoke', name: 'Invoke Function (main)', status: 'idle' },
  { id: 'logs', name: 'Get Function Logs', status: 'idle' },
];

export default function EdgeFunctionTests() {
  const [steps, setSteps] = useState<TestStep[]>(initialSteps);
  const [isRunning, setIsRunning] = useState(false);

  const updateStep = useCallback((id: string, update: Partial<TestStep>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...update } : s)));
  }, []);

  const runAll = useCallback(async () => {
    setIsRunning(true);
    setSteps(initialSteps.map((s) => ({ ...s, status: 'idle', result: undefined })));

    // Test 1: List functions
    updateStep('list', { status: 'running' });
    try {
      const res = await api.get('/tests/functions/list');
      updateStep('list', {
        status: res.data?.success ? 'pass' : 'fail',
        result: res.data,
      });
    } catch (error: any) {
      updateStep('list', {
        status: 'fail',
        result: { success: false, test: 'list', error: error.message },
      });
    }

    // Test 2: Invoke function
    updateStep('invoke', { status: 'running' });
    try {
      const res = await api.post('/tests/functions/invoke', {
        functionName: 'main',
        payload: { name: 'Multibase System Checker' },
      });
      updateStep('invoke', {
        status: res.data?.success ? 'pass' : 'fail',
        result: res.data,
      });
    } catch (error: any) {
      updateStep('invoke', {
        status: 'fail',
        result: { success: false, test: 'invoke', error: error.message },
      });
    }

    // Test 3: Get logs
    updateStep('logs', { status: 'running' });
    try {
      const res = await api.get('/tests/functions/logs?functionName=main');
      updateStep('logs', {
        status: res.data?.success ? 'pass' : 'fail',
        result: res.data,
      });
    } catch (error: any) {
      updateStep('logs', {
        status: 'fail',
        result: { success: false, test: 'logs', error: error.message },
      });
    }

    setIsRunning(false);
  }, [updateStep]);

  const reset = useCallback(() => {
    setSteps(initialSteps.map((s) => ({ ...s, status: 'idle', result: undefined })));
  }, []);

  return (
    <TestPanel
      title='Edge Functions'
      icon={<Zap size={20} color='var(--yellow-9)' />}
      steps={steps}
      onRunAll={runAll}
      onReset={reset}
      isRunning={isRunning}
    />
  );
}
