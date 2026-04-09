import { useState, useCallback } from 'react';
import { Cpu } from 'lucide-react';
import TestPanel from './TestPanel';
import api from '../lib/api';
import type { TestStep } from '../types';

const initialSteps: TestStep[] = [
  { id: 'info', name: 'MCP Server Info', status: 'idle' },
  { id: 'list-tools', name: 'List MCP Tools', status: 'idle' },
  { id: 'call-tool', name: 'Call Tool (list_instances)', status: 'idle' },
  { id: 'get-instance', name: 'Get Instance Details', status: 'idle' },
  { id: 'system-overview', name: 'System Overview', status: 'idle' },
];

export default function McpTests() {
  const [steps, setSteps] = useState<TestStep[]>(initialSteps);
  const [isRunning, setIsRunning] = useState(false);

  const updateStep = useCallback((id: string, update: Partial<TestStep>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...update } : s)));
  }, []);

  const runAll = useCallback(async () => {
    setIsRunning(true);
    setSteps(initialSteps.map((s) => ({ ...s, status: 'idle', result: undefined })));

    const tests: { id: string; method: string; url: string }[] = [
      { id: 'info', method: 'GET', url: '/tests/mcp/info' },
      { id: 'list-tools', method: 'POST', url: '/tests/mcp/list-tools' },
      { id: 'call-tool', method: 'POST', url: '/tests/mcp/call-tool' },
      { id: 'get-instance', method: 'POST', url: '/tests/mcp/get-instance' },
      { id: 'system-overview', method: 'POST', url: '/tests/mcp/system-overview' },
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
      title='MCP Connection'
      icon={<Cpu size={20} color='var(--cyan-9)' />}
      steps={steps}
      onRunAll={runAll}
      onReset={reset}
      isRunning={isRunning}
    />
  );
}
