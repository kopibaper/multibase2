import { useParams, useNavigate, Link } from 'react-router-dom';
import { useState } from 'react';
import {
  useInstance,
  useStartInstance,
  useStopInstance,
  useRestartInstance,
  useRecreateInstance,
  useDeleteInstance,
} from '../hooks/useInstances';
import {
  Loader2,
  ChevronLeft,
  Play,
  Square,
  RotateCw,
  RefreshCcw,
  Server,
  Activity,
  BarChart3,
  FileText,
  Key,
  Trash2,
  Database,
  Mail,
  Settings,
  Copy,
  Code,
  Cloud,
  Building2,
} from 'lucide-react';
import ServicesTab from '../components/ServicesTab';
import MetricsTab from '../components/MetricsTab';
import LogsTab from '../components/LogsTab';
import CredentialsTab from '../components/CredentialsTab';
import SmtpTab from '../components/SmtpTab';
import DatabaseTab from '../components/DatabaseTab';
import ApiTab from '../components/ApiTab';
import StorageSettingsTab from '../components/StorageSettingsTab';
import EnvironmentTab from '../components/EnvironmentTab';
import DeleteInstanceModal from '../components/DeleteInstanceModal';
import CloneInstanceModal from '../components/CloneInstanceModal';
import PageHeader from '../components/PageHeader';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { useOrg } from '../contexts/OrgContext';
import { instancesApi } from '../lib/api';

type TabType =
  | 'services'
  | 'metrics'
  | 'logs'
  | 'credentials'
  | 'database'
  | 'api'
  | 'storage'
  | 'smtp'
  | 'environment';

export default function InstanceDetail() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('services');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showCloneModal, setShowCloneModal] = useState(false);
  const [assigningOrg, setAssigningOrg] = useState(false);
  const { isAdmin } = useAuth();
  const { orgs } = useOrg();

  const { data: instance, isLoading, error } = useInstance(name!);
  const startMutation = useStartInstance();
  const stopMutation = useStopInstance();
  const restartMutation = useRestartInstance();
  const recreateMutation = useRecreateInstance();
  const deleteMutation = useDeleteInstance();

  const handleDelete = async (removeVolumes: boolean) => {
    try {
      await deleteMutation.mutateAsync({ name: instance!.name, removeVolumes });
      toast.success(`Instance ${instance!.name} deleted successfully`);
      navigate('/');
    } catch (error) {
      toast.error(`Deletion failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  if (isLoading) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <Loader2 className='w-8 h-8 animate-spin text-primary' />
      </div>
    );
  }

  if (error || !instance) {
    return (
      <div className='flex items-center justify-center min-h-screen'>
        <div className='text-center'>
          <Server className='w-12 h-12 text-muted-foreground mx-auto mb-4' />
          <h2 className='text-xl font-semibold mb-2'>Instance not found</h2>
          <p className='text-muted-foreground mb-4'>The instance "{name}" could not be found</p>
          <Link
            to='/dashboard'
            className='px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 inline-block'
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const getHealthColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'unhealthy':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const tabs = [
    { id: 'services' as TabType, label: 'Services', icon: Activity },
    { id: 'metrics' as TabType, label: 'Metrics', icon: BarChart3 },
    { id: 'logs' as TabType, label: 'Logs', icon: FileText },
    { id: 'credentials' as TabType, label: 'Credentials', icon: Key },
    { id: 'database' as TabType, label: 'Database', icon: Database },
    { id: 'api' as TabType, label: 'API & Realtime', icon: Server },
    { id: 'storage' as TabType, label: 'Storage', icon: Database },
    { id: 'smtp' as TabType, label: 'SMTP', icon: Mail },
    { id: 'environment' as TabType, label: 'Environment', icon: Settings },
  ];

  return (
    <div className='min-h-screen bg-background'>
      <PageHeader>
        <div className='flex flex-col lg:flex-row lg:items-center gap-4 mb-4'>
          <button
            onClick={() => navigate('/dashboard')}
            className='p-2 hover:bg-muted rounded-md transition-colors self-start'
          >
            <ChevronLeft className='w-5 h-5' />
          </button>
          <div className='flex-1 min-w-0'>
            <div className='flex items-center gap-3 flex-wrap'>
              <Server className='w-6 h-6 text-primary flex-shrink-0' />
              <h2 className='text-xl sm:text-2xl font-bold truncate'>{instance.name}</h2>
              {instance.stackType === 'cloud' && (
                <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-500/20 text-brand-400 border border-brand-500/30'>
                  <Cloud className='w-3 h-3' />
                  Cloud
                </span>
              )}
              <span
                className={`px-3 py-1 rounded-full text-sm font-medium border whitespace-nowrap ${getHealthColor(
                  instance.health.overall
                )}`}
              >
                {instance.health.overall}
              </span>
            </div>
            <p className='text-sm text-muted-foreground mt-1 truncate'>{instance.credentials.project_url}</p>
          </div>
          <div className='flex flex-wrap gap-2 mt-4 lg:mt-0'>
            <Link
              to={`/workspace/projects/${instance.name}`}
              className='flex items-center gap-2 px-3 py-2 sm:px-4 bg-primary/10 text-primary hover:bg-primary/20 rounded-md transition-colors text-sm'
              title='Manage Edge Functions & Database'
            >
              <Code className='w-4 h-4' />
              <span className='hidden sm:inline'>Supabase</span>
            </Link>
            <button
              onClick={() => setShowCloneModal(true)}
              className='flex items-center gap-2 px-3 py-2 sm:px-4 bg-muted hover:bg-muted/80 rounded-md transition-colors text-sm'
              title='Clone this instance'
            >
              <Copy className='w-4 h-4' />
              <span className='hidden sm:inline'>Clone</span>
            </button>
            <button
              onClick={() => restartMutation.mutate(instance.name)}
              disabled={restartMutation.isPending}
              className='flex items-center gap-2 px-3 py-2 sm:px-4 bg-muted hover:bg-muted/80 rounded-md transition-colors disabled:opacity-50 text-sm'
            >
              <RotateCw className={`w-4 h-4 ${restartMutation.isPending ? 'animate-spin' : ''}`} />
              <span className='hidden sm:inline'>{restartMutation.isPending ? 'Restarting...' : 'Restart'}</span>
            </button>
            <button
              onClick={() => {
                if (confirm('Recreate will stop all services, update config, and restart. Continue?')) {
                  recreateMutation.mutate(instance.name);
                }
              }}
              disabled={recreateMutation.isPending}
              className='flex items-center gap-2 px-3 py-2 sm:px-4 bg-amber-600 text-white hover:bg-amber-700 rounded-md transition-colors disabled:opacity-50 text-sm'
              title='Recreate instance with latest docker-compose config'
            >
              <RefreshCcw className={`w-4 h-4 ${recreateMutation.isPending ? 'animate-spin' : ''}`} />
              <span className='hidden sm:inline'>{recreateMutation.isPending ? 'Recreating...' : 'Recreate'}</span>
            </button>
            {instance.status === 'running' || instance.health.overall === 'healthy' ? (
              <button
                onClick={() => stopMutation.mutate(instance.name)}
                disabled={stopMutation.isPending}
                className='flex items-center gap-2 px-3 py-2 sm:px-4 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-md transition-colors disabled:opacity-50 text-sm'
              >
                <Square className='w-4 h-4' />
                <span className='hidden sm:inline'>{stopMutation.isPending ? 'Stopping...' : 'Stop'}</span>
              </button>
            ) : (
              <button
                onClick={() => startMutation.mutate(instance.name)}
                disabled={startMutation.isPending}
                className='flex items-center gap-2 px-3 py-2 sm:px-4 bg-green-600 text-white hover:bg-green-700 rounded-md transition-colors disabled:opacity-50 text-sm'
              >
                <Play className='w-4 h-4' />
                <span className='hidden sm:inline'>{startMutation.isPending ? 'Starting...' : 'Start'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className='grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4'>
          <div className='bg-background rounded-lg p-4 border'>
            <p className='text-xs text-muted-foreground mb-1'>Services</p>
            <p className='text-2xl font-bold'>
              {instance.health.healthyServices}/{instance.health.totalServices}
            </p>
            <p className='text-xs text-muted-foreground mt-1'>Healthy</p>
          </div>
          {instance.metrics && (
            <>
              <div className='bg-background rounded-lg p-4 border'>
                <p className='text-xs text-muted-foreground mb-1'>CPU Usage</p>
                <p className='text-2xl font-bold'>{instance.metrics.cpu.toFixed(1)}%</p>
              </div>
              <div className='bg-background rounded-lg p-4 border'>
                <p className='text-xs text-muted-foreground mb-1'>Memory</p>
                <p className='text-2xl font-bold'>{(instance.metrics.memory / 1024).toFixed(1)} GB</p>
              </div>
              <div className='bg-background rounded-lg p-4 border'>
                <p className='text-xs text-muted-foreground mb-1'>Network</p>
                <p className='text-2xl font-bold'>
                  {((instance.metrics.networkRx + instance.metrics.networkTx) / 1024 / 1024).toFixed(1)} MB/s
                </p>
              </div>
            </>
          )}
        </div>
      </PageHeader>

      {/* Tabs */}
      <div className='border-b bg-card'>
        <div className='container mx-auto px-4 sm:px-6'>
          <div className='flex gap-1 overflow-x-auto scrollbar-hide -mx-4 sm:-mx-6 px-4 sm:px-6'>
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-3 sm:px-4 py-3 border-b-2 transition-colors whitespace-nowrap flex-shrink-0 text-sm ${activeTab === tab.id
                      ? 'border-primary text-primary font-medium'
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted'
                    }`}
                >
                  <Icon className='w-4 h-4' />
                  <span className='hidden sm:inline'>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <main className='container mx-auto px-4 sm:px-6 py-4 sm:py-6'>
        {activeTab === 'services' && <ServicesTab instance={instance} />}
        {activeTab === 'metrics' && <MetricsTab instance={instance} />}
        {activeTab === 'logs' && <LogsTab instance={instance} />}
        {activeTab === 'credentials' && <CredentialsTab instance={instance} />}
        {activeTab === 'database' && <DatabaseTab instance={instance} />}
        {activeTab === 'api' && <ApiTab instance={instance} />}
        {activeTab === 'storage' && <StorageSettingsTab instance={instance} />}
        {activeTab === 'smtp' && <SmtpTab instance={instance} />}
        {activeTab === 'environment' && <EnvironmentTab instance={instance} />}

        {/* Admin: Assign Organisation Section */}
        {isAdmin && (
          <div className='mt-8 pt-6 border-t border-border'>
            <div className='bg-muted/30 border rounded-lg p-4 sm:p-6'>
              <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
                <div>
                  <h3 className='text-lg font-semibold flex items-center gap-2'>
                    <Building2 className='w-5 h-5 text-primary' />
                    Organisation Assignment
                  </h3>
                  <p className='mt-1 text-sm text-muted-foreground'>
                    Assign this instance to an organisation so its members can access it.
                  </p>
                </div>
                <form
                  className='flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:flex-shrink-0'
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const fd = new FormData(e.currentTarget);
                    const selected = fd.get('orgId') as string;
                    const orgId = selected === '__none__' ? null : selected;
                    setAssigningOrg(true);
                    try {
                      await instancesApi.assignOrg(instance.name, orgId);
                      toast.success(orgId ? 'Instance assigned to organisation' : 'Instance unassigned from organisation');
                      window.location.reload(); // Temporary quick fix to reload, or better use queryClient
                    } catch (err: any) {
                      toast.error(err.message || 'Failed to assign org');
                    } finally {
                      setAssigningOrg(false);
                    }
                  }}
                >
                  <select
                    name='orgId'
                    className='px-3 py-2 rounded-md border bg-background text-sm min-w-[200px]'
                    defaultValue={instance.orgId || '__none__'}
                  >
                    <option value='__none__'>— Unassigned —</option>
                    {orgs.map((org) => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </select>
                  <button
                    type='submit'
                    disabled={assigningOrg}
                    className='px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 text-sm'
                  >
                    {assigningOrg ? 'Saving…' : 'Save'}
                  </button>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Delete Instance Section */}
        <div className='mt-12 pt-8 border-t border-border'>
          <div className='bg-destructive/5 border border-destructive/20 rounded-lg p-4 sm:p-6'>
            <div className='flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between'>
              <div>
                <h3 className='text-lg font-semibold text-destructive flex items-center gap-2'>
                  <Trash2 className='w-5 h-5' />
                  Danger Zone
                </h3>
                <p className='mt-2 text-sm text-muted-foreground'>
                  Deleting this instance cannot be undone. All containers will be stopped and removed.
                </p>
              </div>
              <button
                onClick={() => setShowDeleteModal(true)}
                className='flex items-center gap-2 px-4 py-2.5 bg-destructive text-white rounded-md hover:bg-destructive/90 transition-colors sm:flex-shrink-0 w-full sm:w-auto justify-center sm:justify-start'
              >
                <Trash2 className='w-4 h-4' />
                Delete Instance
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* Delete Modal */}
      <DeleteInstanceModal
        instance={instance}
        open={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
      />

      {/* Clone Modal */}
      <CloneInstanceModal isOpen={showCloneModal} onClose={() => setShowCloneModal(false)} sourceName={instance.name} />
    </div>
  );
}
