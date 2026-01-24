import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SupabaseInstance } from '../types';
import { AlertTriangle } from 'lucide-react';
import { useStartInstance, useStopInstance } from '../hooks/useInstances';
import { useAlerts } from '../hooks/useAlerts';
import SaveTemplateModal from './SaveTemplateModal';
import ConfirmDialog from './ConfirmDialog';

interface InstanceCardProps {
  instance: SupabaseInstance;
}

export default function InstanceCard({ instance }: InstanceCardProps) {
  const navigate = useNavigate();
  const startMutation = useStartInstance();
  const stopMutation = useStopInstance();
  const { data: alerts } = useAlerts({ instanceId: instance.id, status: 'active' });
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-emerald-400';
      case 'degraded':
        return 'text-yellow-400';
      case 'unhealthy':
        return 'text-red-400';
      case 'stopped':
        return 'text-gray-500';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusDot = (status: string) => {
    const baseClasses = 'w-2 h-2 rounded-full';
    switch (status) {
      case 'healthy':
        return `${baseClasses} bg-emerald-400`;
      case 'degraded':
        return `${baseClasses} bg-yellow-400`;
      case 'unhealthy':
        return `${baseClasses} bg-red-400`;
      case 'stopped':
        return `${baseClasses} bg-gray-500`;
      default:
        return `${baseClasses} bg-gray-500`;
    }
  };

  const handleStart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    await startMutation.mutateAsync(instance.name);
  };

  const handleStop = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowStopConfirm(true);
  };

  const confirmStop = async () => {
    setShowStopConfirm(false);
    await stopMutation.mutateAsync(instance.name);
  };

  const handleCardClick = () => {
    navigate(`/instances/${instance.name}`);
  };

  const handleManage = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/instances/${instance.name}`);
  };

  const handleRestart = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (instance.health.overall !== 'stopped') {
      await stopMutation.mutateAsync(instance.name);
      setTimeout(async () => {
        await startMutation.mutateAsync(instance.name);
      }, 2000);
    }
  };

  const handleSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/instances/${instance.name}?tab=settings`);
  };

  return (
    <>
      <div
        onClick={handleCardClick}
        className='bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl p-5 hover:border-emerald-500/30 hover:bg-slate-800/70 transition-all cursor-pointer group'
      >
        {/* Header */}
        <div className='mb-4'>
          <div className='flex items-center justify-between'>
            <h3 className='text-lg font-semibold text-white group-hover:text-emerald-400 transition-colors'>
              {instance.name}
              {alerts && alerts.length > 0 && (
                <span
                  className='ml-2 inline-flex'
                  title={`${alerts.length} active alert${alerts.length !== 1 ? 's' : ''}`}
                >
                  <AlertTriangle className='w-4 h-4 text-orange-400 animate-pulse' />
                </span>
              )}
            </h3>
          </div>

          {/* Status */}
          <div className='flex items-center gap-2 mt-2'>
            <span className={getStatusDot(instance.health.overall)} />
            <span className={`text-sm capitalize ${getStatusColor(instance.health.overall)}`}>
              {instance.health.overall === 'healthy' ? 'Running' : instance.health.overall}
            </span>
          </div>
        </div>

        {/* Quick Actions */}
        <div className='flex items-center gap-4 text-sm'>
          <button onClick={handleManage} className='text-slate-400 hover:text-white transition-colors'>
            Manage
          </button>

          {instance.health.overall !== 'stopped' ? (
            <button
              onClick={handleRestart}
              disabled={stopMutation.isPending || startMutation.isPending}
              className='text-slate-400 hover:text-white transition-colors disabled:opacity-50'
            >
              Restart
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={startMutation.isPending}
              className='text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50'
            >
              Start
            </button>
          )}

          <button onClick={handleSettings} className='text-slate-400 hover:text-white transition-colors'>
            Settings
          </button>
        </div>
      </div>

      {showSaveModal && (
        <div onClick={(e) => e.stopPropagation()}>
          <SaveTemplateModal
            onClose={() => setShowSaveModal(false)}
            instanceConfig={{
              deploymentType: 'localhost',
              basePort: instance.basePort,
            }}
          />
        </div>
      )}

      {/* Stop Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showStopConfirm}
        title='Stop Instance'
        message={`Are you sure you want to stop "${instance.name}"? All services will be shut down.`}
        confirmText='Stop'
        variant='danger'
        onConfirm={confirmStop}
        onCancel={() => setShowStopConfirm(false)}
      />
    </>
  );
}
