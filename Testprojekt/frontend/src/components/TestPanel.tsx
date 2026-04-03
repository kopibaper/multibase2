import { Badge, Button, Text, Heading, Spinner } from '@radix-ui/themes';
import { Play, RotateCcw, CheckCircle2, XCircle, Circle } from 'lucide-react';
import type { TestStep, TestStatus } from '../types';

interface TestPanelProps {
  title: string;
  icon: React.ReactNode;
  steps: TestStep[];
  onRunAll: () => void;
  onReset: () => void;
  isRunning: boolean;
}

function StatusIcon({ status }: { status: TestStatus }) {
  switch (status) {
    case 'pass':
      return <CheckCircle2 size={18} color='var(--green-9)' />;
    case 'fail':
      return <XCircle size={18} color='var(--red-9)' />;
    case 'running':
      return <Spinner size='1' />;
    default:
      return <Circle size={18} color='var(--gray-8)' />;
  }
}

function StatusBadge({ steps }: { steps: TestStep[] }) {
  const passed = steps.filter((s) => s.status === 'pass').length;
  const failed = steps.filter((s) => s.status === 'fail').length;
  const total = steps.length;
  const running = steps.some((s) => s.status === 'running');

  if (running) return <Badge color='yellow'>Running...</Badge>;
  if (failed > 0)
    return (
      <Badge color='red'>
        {passed}/{total} passed
      </Badge>
    );
  if (passed === total && total > 0)
    return (
      <Badge color='green'>
        {total}/{total} passed
      </Badge>
    );
  return <Badge color='gray'>Ready</Badge>;
}

export default function TestPanel({ title, icon, steps, onRunAll, onReset, isRunning }: TestPanelProps) {
  return (
    <div className='test-panel'>
      <div className='test-panel-header'>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {icon}
          <Heading size='3'>{title}</Heading>
          <StatusBadge steps={steps} />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size='1' variant='soft' color='gray' onClick={onReset} disabled={isRunning}>
            <RotateCcw size={14} />
          </Button>
          <Button size='1' onClick={onRunAll} disabled={isRunning}>
            <Play size={14} />
            Run All
          </Button>
        </div>
      </div>
      <div className='test-panel-body'>
        {steps.map((step) => (
          <div key={step.id}>
            <div className='test-step'>
              <StatusIcon status={step.status} />
              <span className='test-step-name'>
                <Text size='2' weight='medium'>
                  {step.name}
                </Text>
              </span>
            </div>
            {step.result && (
              <div className='test-log'>{JSON.stringify(step.result.data || step.result.error, null, 2)}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
