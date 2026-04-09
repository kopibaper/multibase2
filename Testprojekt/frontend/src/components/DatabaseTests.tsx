import { useState, useCallback } from 'react';
import { Database } from 'lucide-react';
import TestPanel from './TestPanel';
import api from '../lib/api';
import type { TestStep } from '../types';

const initialSteps: TestStep[] = [
  { id: 'create-table', name: 'Create Test Table (_test_items)', status: 'idle' },
  { id: 'insert', name: 'Insert Test Data (3 rows)', status: 'idle' },
  { id: 'read', name: 'Read Data', status: 'idle' },
  { id: 'update', name: 'Update Row', status: 'idle' },
  { id: 'delete', name: 'Delete Row', status: 'idle' },
  { id: 'cleanup', name: 'Cleanup (Drop Table)', status: 'idle' },
];

export default function DatabaseTests() {
  const [steps, setSteps] = useState<TestStep[]>(initialSteps);
  const [isRunning, setIsRunning] = useState(false);

  const updateStep = useCallback((id: string, update: Partial<TestStep>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...update } : s)));
  }, []);

  const runAll = useCallback(async () => {
    setIsRunning(true);
    setSteps(initialSteps.map((s) => ({ ...s, status: 'idle', result: undefined })));

    const tests: { id: string; method: string; url: string }[] = [
      { id: 'create-table', method: 'POST', url: '/tests/db/create-table' },
      { id: 'insert', method: 'POST', url: '/tests/db/insert' },
      { id: 'read', method: 'GET', url: '/tests/db/read' },
      { id: 'update', method: 'PUT', url: '/tests/db/update' },
      { id: 'delete', method: 'DELETE', url: '/tests/db/delete' },
      { id: 'cleanup', method: 'DELETE', url: '/tests/db/cleanup' },
    ];

    for (const test of tests) {
      updateStep(test.id, { status: 'running' });
      try {
        let res;
        switch (test.method) {
          case 'GET':
            res = await api.get(test.url);
            break;
          case 'POST':
            res = await api.post(test.url);
            break;
          case 'PUT':
            res = await api.put(test.url);
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
        // Stop on failure (except cleanup)
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
      title='Database (CRUD)'
      icon={<Database size={20} color='var(--green-9)' />}
      steps={steps}
      onRunAll={runAll}
      onReset={reset}
      isRunning={isRunning}
    />
  );
}
