import { useCallback, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useInstance } from '../hooks/useInstances';
import {
  ChevronLeft,
  LayoutDashboard,
  Database,
  HardDrive,
  Shield,
  Zap,
  Webhook,
  Clock,
  Brain,
  ListOrdered,
  Mail,
  Key,
  ExternalLink,
  Loader2,
  Server,
  Activity,
  CheckCircle,
  AlertCircle,
  XCircle,
  Cloud,
  Copy,
  Check,
  Eye,
  EyeOff,
  Lock,
  Plug,
  Globe,
  KeyRound,
  ShieldCheck,
  Radio,
  GitBranch,
  ArrowUpFromLine,
  Package,
  Menu,
  X,
} from 'lucide-react';
import StorageTab from '../components/StorageTab';
import PoliciesTab from '../components/PoliciesTab';
import FunctionsTab from '../components/FunctionsTab';
import WebhooksTab from '../components/WebhooksTab';
import CronJobsTab from '../components/CronJobsTab';
import VectorsTab from '../components/VectorsTab';
import QueuesTab from '../components/QueuesTab';
import ApiTab from '../components/ApiTab';
import WorkspaceSmtpPanel from '../components/workspace/WorkspaceSmtpPanel';
import { DatabasePanel } from '../components/workspace/WorkspaceManagerPanel';
import AuthTab from '../components/AuthTab';
import DomainsPanel from '../components/workspace/DomainsPanel';
import VaultPanel from '../components/workspace/VaultPanel';
import SecurityPanel from '../components/workspace/SecurityPanel';
import RealtimePanel from '../components/workspace/RealtimePanel';
import ReplicasPanel from '../components/workspace/ReplicasPanel';
import LogDrainsPanel from '../components/workspace/LogDrainsPanel';
import ExtensionsTab from '../components/ExtensionsTab';
import type { SupabaseInstance } from '../types';

import { startStudioHeartbeat } from '../lib/studioHeartbeat';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type TabId =
  | 'overview'
  | 'database'
  | 'storage'
  | 'policies'
  | 'functions'
  | 'webhooks'
  | 'cron'
  | 'vectors'
  | 'queues'
  | 'smtp'
  | 'keys'
  | 'api'
  | 'auth'
  | 'domains'
  | 'vault'
  | 'security'
  | 'realtime'
  | 'replicas'
  | 'log-drains'
  | 'extensions';

const NAV_GROUPS: { title: string; items: { id: TabId; label: string; icon: React.ElementType }[] }[] = [
  {
    title: 'Project',
    items: [
      { id: 'overview', label: 'Overview', icon: LayoutDashboard },
      { id: 'auth', label: 'Authentication', icon: Lock },
      { id: 'database', label: 'Database', icon: Database },
      { id: 'storage', label: 'Storage', icon: HardDrive },
      { id: 'policies', label: 'RLS Policies', icon: Shield },
    ],
  },
  {
    title: 'Backend',
    items: [
      { id: 'functions', label: 'Edge Functions', icon: Zap },
      { id: 'webhooks', label: 'Webhooks', icon: Webhook },
      { id: 'cron', label: 'Cron Jobs', icon: Clock },
      { id: 'vectors', label: 'Vectors', icon: Brain },
      { id: 'queues', label: 'Queues', icon: ListOrdered },
      { id: 'api', label: 'API & GraphQL', icon: Plug },
      { id: 'realtime', label: 'Realtime', icon: Radio },
      { id: 'extensions', label: 'Extensions', icon: Package },
    ],
  },
  {
    title: 'Configuration',
    items: [
      { id: 'smtp', label: 'SMTP Settings', icon: Mail },
      { id: 'keys', label: 'API Keys', icon: Key },
      { id: 'domains', label: 'Custom Domains', icon: Globe },
      { id: 'vault', label: 'Vault Secrets', icon: KeyRound },
      { id: 'security', label: 'Network Security', icon: ShieldCheck },
      { id: 'replicas', label: 'Read Replicas', icon: GitBranch },
      { id: 'log-drains', label: 'Log Drains', icon: ArrowUpFromLine },
    ],
  },
];

function statusInfo(status: string): { color: string; label: string } {
  switch (status) {
    case 'running':
    case 'healthy':
      return { color: 'bg-green-500', label: 'Healthy' };
    case 'degraded':
      return { color: 'bg-yellow-500', label: 'Degraded' };
    case 'stopped':
      return { color: 'bg-gray-500', label: 'Stopped' };
    default:
      return { color: 'bg-red-500', label: 'Unhealthy' };
  }
}

export default function WorkspaceProjectPage() {
  const { project, tab } = useParams<{ project: string; tab: string }>();
  const navigate = useNavigate();
  const { data: instance, isLoading } = useInstance(project!);
  const [studioActivating, setStudioActivating] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const activeTab: TabId = (tab as TabId) ?? 'overview';
  const activeSidebarLabel =
    NAV_GROUPS.flatMap((g) => g.items).find((item) => item.id === activeTab)?.label || 'Overview';

  const handleNav = useCallback(
    (tabId: TabId) => {
      if (tabId === 'overview') {
        navigate(`/workspace/projects/${project}`);
      } else {
        navigate(`/workspace/projects/${project}/${tabId}`);
      }
    },
    [navigate, project]
  );

  const handleOpenStudio = useCallback(async () => {
    if (!instance || instance.status === 'stopped') return;
    const isCloud = instance.stackType === 'cloud';
    if (!isCloud) {
      const url = instance.credentials?.studio_url || `http://${window.location.hostname}:${instance.ports?.studio}`;
      window.open(url, '_blank');
      return;
    }
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
      const data = await res.json();
      const win = window.open(data.studioUrl || `http://${window.location.hostname}:3000`, '_blank');
      if (win) startStudioHeartbeat(win, instance.name, API_BASE_URL, token);
    } catch {
      // fail silently
    } finally {
      setStudioActivating(false);
    }
  }, [instance]);

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-[calc(100vh-4rem)]'>
        <Loader2 className='w-8 h-8 animate-spin text-brand-500' />
      </div>
    );
  }

  if (!instance) {
    return (
      <div className='flex items-center justify-center h-[calc(100vh-4rem)]'>
        <div className='text-center'>
          <Server className='w-12 h-12 text-muted-foreground/40 mx-auto mb-4' />
          <h2 className='text-xl font-semibold mb-2'>Project not found</h2>
          <p className='text-muted-foreground mb-4'>"{project}" could not be found</p>
          <button onClick={() => navigate('/workspace/projects')} className='text-brand-400 hover:underline text-sm'>
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  const health = instance.health?.overall || instance.status;
  const { color: statusColor, label: statusLabel } = statusInfo(health);

  return (
    <div className='flex h-[calc(100vh-4rem)] max-sm:h-[calc(100svh-8rem)]'>
      {/* Mobile overlay backdrop */}
      {mobileSidebarOpen && (
        <div
          className='md:hidden fixed top-16 inset-x-0 bottom-0 z-40 bg-black/60'
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={`shrink-0 flex flex-col glass-panel rounded-none
          md:w-60 md:static md:flex
          ${mobileSidebarOpen ? 'fixed top-16 left-0 bottom-0 w-72 z-50' : 'hidden md:flex'}`}
      >
        {/* Project header */}
        <div className='p-4 border-b border-white/5'>
          <div className='flex items-center justify-between mb-3'>
            <button
              onClick={() => navigate('/workspace/projects')}
              className='flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors'
            >
              <ChevronLeft className='w-3.5 h-3.5' />
              All Projects
            </button>
            <button
              onClick={() => setMobileSidebarOpen(false)}
              className='md:hidden p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors'
            >
              <X className='w-4 h-4' />
            </button>
          </div>
          <div className='flex items-center gap-2.5 min-w-0'>
            <div className='w-8 h-8 rounded-lg bg-brand-500/15 flex items-center justify-center shrink-0'>
              <Database className='w-4 h-4 text-brand-400' />
            </div>
            <div className='min-w-0'>
              <p className='text-sm font-semibold text-foreground truncate'>{instance.name}</p>
              <div className='flex items-center gap-1.5'>
                <span className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
                <span className='text-xs text-muted-foreground'>{statusLabel}</span>
                {instance.stackType === 'cloud' && <Cloud className='w-3 h-3 text-brand-400 ml-0.5' />}
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className='flex-1 overflow-y-auto py-3 px-2'>
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className='mb-3'>
              <p className='px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60'>
                {group.title}
              </p>
              <div className='space-y-0.5 mt-1'>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.id === activeTab || (item.id === 'overview' && !tab);
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        handleNav(item.id);
                        setMobileSidebarOpen(false);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-left ${
                        isActive
                          ? 'bg-brand-500/15 text-brand-400 shadow-[inset_0_0_0_1px_rgba(62,207,142,0.3)]'
                          : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
                      }`}
                    >
                      <Icon className='w-4 h-4 shrink-0' />
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Studio button */}
        <div className='p-3 border-t border-white/5'>
          <button
            onClick={handleOpenStudio}
            disabled={studioActivating || instance.status === 'stopped'}
            className='w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-white/5 hover:text-foreground transition-colors disabled:opacity-40'
          >
            {studioActivating ? <Loader2 className='w-4 h-4 animate-spin' /> : <ExternalLink className='w-4 h-4' />}
            Open Studio
          </button>
        </div>
      </aside>

      {/* ── Content ── */}
      <main className='flex-1 overflow-y-auto flex flex-col min-w-0'>
        {/* Mobile header with hamburger */}
        <div className='md:hidden sticky top-0 z-30 flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-background/90 backdrop-blur-md shrink-0'>
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className='p-1.5 rounded-lg hover:bg-white/5 text-muted-foreground hover:text-foreground transition-colors'
          >
            <Menu className='w-5 h-5' />
          </button>
          <div className='flex-1 min-w-0'>
            <p className='text-sm font-semibold text-foreground truncate'>{instance.name}</p>
            <p className='text-xs text-muted-foreground'>{activeSidebarLabel}</p>
          </div>
        </div>
        <div className='p-4 sm:p-6'>
          {(!tab || tab === 'overview') && <OverviewContent instance={instance} onOpenStudio={handleOpenStudio} />}
          {tab === 'database' && <DatabasePanel instanceName={project!} />}
          {tab === 'storage' && <StorageTab instanceName={project!} instance={instance} />}
          {tab === 'policies' && <PoliciesTab instanceName={project!} />}
          {tab === 'functions' && <FunctionsTab instanceName={project!} />}
          {tab === 'webhooks' && <WebhooksTab instanceName={project!} />}
          {tab === 'cron' && <CronJobsTab instanceName={project!} />}
          {tab === 'vectors' && <VectorsTab instanceName={project!} />}
          {tab === 'queues' && <QueuesTab instanceName={project!} />}
          {tab === 'api' && <ApiTab instance={instance} />}
          {tab === 'smtp' && <WorkspaceSmtpPanel instance={instance} />}
          {tab === 'keys' && <KeysPanel instance={instance} />}
          {tab === 'auth' && <AuthTab instance={instance} />}
          {tab === 'domains' && <DomainsPanel instance={instance} />}
          {tab === 'vault' && <VaultPanel instanceName={project!} />}
          {tab === 'security' && <SecurityPanel instanceName={project!} />}
          {tab === 'realtime' && <RealtimePanel instanceName={project!} />}
          {tab === 'replicas' && <ReplicasPanel instanceName={project!} />}
          {tab === 'log-drains' && <LogDrainsPanel instanceName={project!} />}
          {tab === 'extensions' && <ExtensionsTab instanceName={project!} />}
        </div>
      </main>
    </div>
  );
}

// ── Overview Content ──────────────────────────────────────────────────────────

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div>
      <label className='text-xs text-muted-foreground'>{label}</label>
      <div className='flex items-center gap-2 mt-1'>
        <code className='flex-1 text-xs bg-white/5 px-3 py-2 rounded-lg font-mono truncate text-foreground'>
          {value || '—'}
        </code>
        {value && (
          <button
            onClick={handleCopy}
            className='p-1.5 rounded-lg text-muted-foreground/50 hover:text-brand-400 transition-colors shrink-0'
          >
            {copied ? <Check className='w-3.5 h-3.5 text-green-400' /> : <Copy className='w-3.5 h-3.5' />}
          </button>
        )}
      </div>
    </div>
  );
}

function OverviewContent({ instance, onOpenStudio }: { instance: SupabaseInstance; onOpenStudio: () => void }) {
  const health = (instance.health?.overall || instance.status) as string;

  const statusBadge = () => {
    if (health === 'running' || health === 'healthy')
      return (
        <span className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-500/15 text-green-400'>
          <CheckCircle className='w-3 h-3' /> Healthy
        </span>
      );
    if (health === 'degraded')
      return (
        <span className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-500/15 text-yellow-400'>
          <AlertCircle className='w-3 h-3' /> Degraded
        </span>
      );
    if (health === 'stopped')
      return (
        <span className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-500/15 text-gray-400'>
          <Activity className='w-3 h-3' /> Stopped
        </span>
      );
    return (
      <span className='inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/15 text-red-400'>
        <XCircle className='w-3 h-3' /> Unhealthy
      </span>
    );
  };

  return (
    <div className='space-y-5 max-w-3xl'>
      {/* Header */}
      <div className='flex items-center justify-between flex-wrap gap-3'>
        <div>
          <h1 className='text-2xl font-bold text-foreground'>{instance.name}</h1>
          <p className='text-sm text-muted-foreground mt-0.5'>
            {instance.credentials?.project_url || 'No project URL configured'}
          </p>
        </div>
        <div className='flex items-center gap-2'>
          {statusBadge()}
          {instance.stackType === 'cloud' && (
            <span className='inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-brand-500/15 text-brand-400'>
              <Cloud className='w-3 h-3' /> Cloud
            </span>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className='flex flex-wrap gap-2'>
        <button
          onClick={onOpenStudio}
          disabled={instance.status === 'stopped'}
          className='flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-500/10 border border-brand-500/20 hover:bg-brand-500/20 text-sm font-medium text-brand-400 transition-colors disabled:opacity-40'
        >
          <ExternalLink className='w-4 h-4' />
          Open Studio
        </button>
      </div>

      {/* Connection Details */}
      <div className='glass-card p-5 space-y-4'>
        <h3 className='text-sm font-semibold text-foreground flex items-center gap-2'>
          <Server className='w-4 h-4 text-brand-400' />
          Connection Details
        </h3>
        <CopyField label='Project URL' value={instance.credentials?.project_url || ''} />
        <CopyField label='Studio URL' value={instance.credentials?.studio_url || ''} />
      </div>

      {/* Services */}
      {instance.services && instance.services.length > 0 && (
        <div className='glass-card p-5'>
          <h3 className='text-sm font-semibold text-foreground flex items-center gap-2 mb-4'>
            <Activity className='w-4 h-4 text-brand-400' />
            Services
          </h3>
          <div className='grid grid-cols-2 sm:grid-cols-3 gap-2'>
            {instance.services.map((svc: any) => (
              <div key={svc.name} className='flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-sm'>
                <div
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    svc.status === 'running' || svc.health === 'healthy'
                      ? 'bg-green-500'
                      : svc.status === 'stopped'
                        ? 'bg-gray-500'
                        : 'bg-red-500'
                  }`}
                />
                <span className='truncate text-muted-foreground text-xs'>{svc.name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Info */}
      <div className='glass-card p-5'>
        <h3 className='text-sm font-semibold text-foreground mb-4'>Project Info</h3>
        <dl className='grid grid-cols-2 gap-x-4 gap-y-3 text-sm'>
          <div>
            <dt className='text-xs text-muted-foreground'>Stack Type</dt>
            <dd className='text-foreground font-medium mt-0.5 capitalize'>{instance.stackType || 'local'}</dd>
          </div>
          <div>
            <dt className='text-xs text-muted-foreground'>Status</dt>
            <dd className='text-foreground font-medium mt-0.5 capitalize'>{instance.status}</dd>
          </div>
          {instance.ports?.postgres && (
            <div>
              <dt className='text-xs text-muted-foreground'>DB Port</dt>
              <dd className='text-foreground font-medium font-mono mt-0.5'>{instance.ports.postgres}</dd>
            </div>
          )}
          {instance.ports?.gateway_port && (
            <div>
              <dt className='text-xs text-muted-foreground'>Gateway Port</dt>
              <dd className='text-foreground font-medium font-mono mt-0.5'>{instance.ports.gateway_port}</dd>
            </div>
          )}
        </dl>
      </div>
    </div>
  );
}

// ── Keys Panel ────────────────────────────────────────────────────────────────

interface KeyFieldProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  sensitive?: boolean;
}

function KeyField({ label, value, icon, sensitive = true }: KeyFieldProps) {
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(!sensitive);

  const handleCopy = async () => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayValue = !value
    ? '—'
    : visible
      ? value
      : value.substring(0, 8) + '•'.repeat(Math.min(20, value.length - 8));

  return (
    <div>
      <div className='flex items-center justify-between mb-1.5'>
        <label className='text-xs font-medium text-muted-foreground flex items-center gap-1.5'>
          {icon}
          {label}
        </label>
        <div className='flex items-center gap-1'>
          {sensitive && (
            <button
              onClick={() => setVisible(!visible)}
              className='p-1 rounded text-muted-foreground/50 hover:text-muted-foreground transition-colors'
            >
              {visible ? <EyeOff className='w-3.5 h-3.5' /> : <Eye className='w-3.5 h-3.5' />}
            </button>
          )}
          <button
            onClick={handleCopy}
            disabled={!value}
            className='p-1 rounded text-muted-foreground/50 hover:text-brand-400 transition-colors disabled:opacity-30'
          >
            {copied ? <Check className='w-3.5 h-3.5 text-green-400' /> : <Copy className='w-3.5 h-3.5' />}
          </button>
        </div>
      </div>
      <div className='bg-white/5 border border-white/10 rounded-lg px-3 py-2 font-mono text-xs text-foreground break-all leading-relaxed'>
        {displayValue}
      </div>
    </div>
  );
}

function KeysPanel({ instance }: { instance: SupabaseInstance }) {
  const creds = instance.credentials;
  return (
    <div className='space-y-5 max-w-2xl'>
      <div>
        <h2 className='text-xl font-bold text-foreground'>API Keys</h2>
        <p className='text-sm text-muted-foreground mt-1'>
          Keys and credentials for <strong>{instance.name}</strong>
        </p>
      </div>
      <div className='glass-card p-5 space-y-5'>
        <KeyField label='Anon Key (public)' value={creds?.anon_key || ''} icon={<Key className='w-3 h-3' />} />
        <KeyField
          label='Service Role Key (secret)'
          value={creds?.service_role_key || ''}
          icon={<Shield className='w-3 h-3' />}
        />
        <KeyField label='JWT Secret' value={creds?.jwt_secret || ''} icon={<Lock className='w-3 h-3' />} />
        <KeyField
          label='Project URL'
          value={creds?.project_url || ''}
          icon={<Database className='w-3 h-3' />}
          sensitive={false}
        />
      </div>
    </div>
  );
}
