import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { SupabaseInstance } from '../types';
import { useAuth } from '../contexts/AuthContext';
import {
  Activity,
  Server,
  CheckCircle,
  XCircle,
  AlertCircle,
  AlertTriangle,
  Play,
  Square,
  ExternalLink,
  Save,
  Database,
  Cloud,
} from 'lucide-react';
import { useStartInstance, useStopInstance } from '../hooks/useInstances';
import { useAlerts } from '../hooks/useAlerts';
import SaveTemplateModal from './SaveTemplateModal';
import ConfirmDialog from './ConfirmDialog';
import { UptimeChart } from './UptimeChart';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

interface InstanceCardProps {
  instance: SupabaseInstance;
  isSelected?: boolean;
  onToggleSelect?: (name: string) => void;
}

export default function InstanceCard({ instance, isSelected, onToggleSelect }: InstanceCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canTakeActions = user?.role !== 'viewer';
  const startMutation = useStartInstance();
  const stopMutation = useStopInstance();
  const { data: alerts } = useAlerts({ instanceId: instance.id, status: 'active' });
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [studioActivating, setStudioActivating] = useState(false);

  const isCloudInstance = instance.stackType === 'cloud';

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'text-green-600 bg-green-100';
      case 'degraded':
        return 'text-yellow-600 bg-yellow-100';
      case 'unhealthy':
        return 'text-red-600 bg-red-100';
      case 'stopped':
        return 'text-gray-600 bg-gray-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className='w-5 h-5' />;
      case 'degraded':
        return <AlertCircle className='w-5 h-5' />;
      case 'unhealthy':
        return <XCircle className='w-5 h-5' />;
      default:
        return <Activity className='w-5 h-5' />;
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

  const handleOpenStudio = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!isCloudInstance) {
        // Classic stack: open Studio directly
        const url = instance.credentials.studio_url || `http://${window.location.hostname}:${instance.ports.studio}`;
        window.open(url, '_blank');
        return;
      }

      // Cloud stack: activate tenant first, then open shared Studio
      setStudioActivating(true);
      try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`${API_BASE_URL}/api/studio/activate/${instance.name}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: 'Unknown error' }));
          throw new Error(err.message || `HTTP ${res.status}`);
        }
        const data = await res.json();
        window.open(data.studioUrl || `http://${window.location.hostname}:3000`, '_blank');
      } catch (err: any) {
        console.error('Studio activation failed:', err);
        alert(`Studio activation failed: ${err.message}`);
      } finally {
        setStudioActivating(false);
      }
    },
    [instance, isCloudInstance]
  );

  const handleCardClick = () => {
    navigate(`/instances/${instance.name}`);
  };

  return (
    <>
      <div
        onClick={handleCardClick}
        className='glass-card p-6 cursor-pointer transition-all duration-300 hover:scale-[1.02]'
      >
        {/* Header */}
        <div className='flex items-start justify-between mb-4'>
          {/* Selection Checkbox */}
          {onToggleSelect && (
            <div
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect(instance.name);
              }}
              className={`mr-3 flex-shrink-0 w-5 h-5 rounded border-2 cursor-pointer transition-colors flex items-center justify-center ${
                isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/40 hover:border-primary/60'
              }`}
            >
              {isSelected && (
                <svg className='w-3 h-3 text-primary-foreground' fill='none' viewBox='0 0 24 24' stroke='currentColor'>
                  <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={3} d='M5 13l4 4L19 7' />
                </svg>
              )}
            </div>
          )}
          <div className='flex-1'>
            <h3 className='text-xl font-semibold text-foreground flex items-center gap-2'>
              <Server className='w-5 h-5 text-primary' />
              {instance.name}
              {instance.stackType === 'cloud' && (
                <span className='inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-medium bg-brand-500/20 text-brand-400'>
                  <Cloud className='w-3 h-3' />
                </span>
              )}
              {alerts && alerts.length > 0 && (
                <span
                  className='relative flex items-center'
                  title={`${alerts.length} active alert${alerts.length !== 1 ? 's' : ''}`}
                >
                  <AlertTriangle className='w-5 h-5 text-orange-500 animate-pulse' />
                  <span className='absolute -top-1 -right-1 bg-orange-500 text-white text-xs font-bold rounded-full w-4 h-4 flex items-center justify-center'>
                    {alerts.length}
                  </span>
                </span>
              )}
            </h3>
            <p className='text-sm text-muted-foreground mt-1'>{instance.credentials.project_url}</p>
          </div>

          <div className='flex gap-2 items-center'>
            {canTakeActions && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setShowSaveModal(true);
                }}
                className='p-1 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors'
                title='Save as Template'
              >
                <Save className='w-4 h-4' />
              </button>
            )}

            <div
              className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${getHealthColor(
                instance.health.overall
              )}`}
            >
              {getHealthIcon(instance.health.overall)}
              <span className='capitalize'>{instance.health.overall}</span>
            </div>
          </div>
        </div>

        {/* Services Stats */}
        <div className='mb-4 pb-4 border-b'>
          <div className='flex items-center justify-between text-sm'>
            <span className='text-muted-foreground'>Services</span>
            <span className='font-medium'>
              {instance.health.healthyServices} / {instance.health.totalServices} healthy
            </span>
          </div>
          <div className='mt-2 flex-1 bg-muted rounded-full h-2 overflow-hidden'>
            <div
              className='bg-green-500 h-full transition-all'
              style={{
                width: `${(instance.health.healthyServices / instance.health.totalServices) * 100}%`,
              }}
            />
          </div>
        </div>

        {/* Metrics */}
        {instance.metrics && (
          <div className='grid grid-cols-2 gap-4 mb-4'>
            <div>
              <p className='text-xs text-muted-foreground'>CPU</p>
              <p className='text-lg font-semibold'>{instance.metrics.cpu.toFixed(1)}%</p>
            </div>
            <div>
              <p className='text-xs text-muted-foreground'>Memory</p>
              <p className='text-lg font-semibold'>{(instance.metrics.memory / 1024).toFixed(1)} GB</p>
            </div>
          </div>
        )}

        {/* Uptime Chart */}
        <div className='mb-4'>
          <UptimeChart instanceName={instance.name} days={10} />
        </div>

        {/* Actions */}
        <div className='flex gap-2'>
          {/* Show Stop button for any running/healthy/degraded/unhealthy instance */}
          {instance.health.overall !== 'stopped' ? (
            <>
              {canTakeActions && (
                <button
                  onClick={handleStop}
                  disabled={stopMutation.isPending}
                  className='flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-destructive/10 text-destructive rounded-md hover:bg-destructive/20 transition-colors text-sm font-medium disabled:opacity-50'
                >
                  <Square className='w-4 h-4' />
                  {stopMutation.isPending ? 'Stopping...' : 'Stop'}
                </button>
              )}
              <button
                onClick={handleOpenStudio}
                disabled={studioActivating}
                className='flex items-center justify-center gap-2 px-3 py-2 bg-violet-500/10 text-violet-600 dark:text-violet-400 rounded-md hover:bg-violet-500/20 transition-colors text-sm font-medium disabled:opacity-50'
                title={
                  isCloudInstance
                    ? `Activate & Open Studio for ${instance.name}`
                    : `Open Studio (Port ${instance.ports.studio})`
                }
              >
                <ExternalLink className='w-4 h-4' />
                {studioActivating ? 'Activating...' : 'Studio'}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/instances/${instance.name}/supabase`);
                }}
                className='flex items-center justify-center gap-2 px-3 py-2 bg-primary/10 text-primary rounded-md hover:bg-primary/20 transition-colors text-sm font-medium'
                title='Open Database Manager'
              >
                <Database className='w-4 h-4' />
                Manager
              </button>
            </>
          ) : (
            canTakeActions && (
              <button
                onClick={handleStart}
                disabled={startMutation.isPending}
                className='flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-100 text-green-700 rounded-md hover:bg-green-200 transition-colors text-sm font-medium disabled:opacity-50'
              >
                <Play className='w-4 h-4' />
                {startMutation.isPending ? 'Starting...' : 'Start'}
              </button>
            )
          )}
        </div>

        <div className='mt-4 pt-4 border-t text-xs text-muted-foreground'>
          Last checked: {new Date(instance.health.lastChecked).toLocaleTimeString()}
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
