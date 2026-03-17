import { useState, useCallback } from 'react';
import { useInstances } from '../hooks/useInstances';
import {
  ExternalLink,
  Key,
  Mail,
  Search,
  Server,
  Cloud,
  CheckCircle,
  XCircle,
  AlertCircle,
  Activity,
  Loader2,
  FolderKanban,
  ChevronRight,
  ChevronLeft,
  Database,
  Code,
} from 'lucide-react';
import type { SupabaseInstance } from '../types';
import KeysQuickModal from '../components/workspace/KeysQuickModal';
import WorkspaceSmtpPanel from '../components/workspace/WorkspaceSmtpPanel';
import WorkspaceManagerPanel from '../components/workspace/WorkspaceManagerPanel';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function WorkspacePage() {
  const { data: instances, isLoading } = useInstances();
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [keysModalInstance, setKeysModalInstance] = useState<SupabaseInstance | null>(null);
  const [studioActivating, setStudioActivating] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'smtp' | 'manager'>('overview');

  const filteredInstances = instances?.filter(
    (i) =>
      i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.credentials?.project_url?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selected = instances?.find((i) => i.name === selectedProject) || null;

  const getHealthIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className='w-4 h-4 text-green-500' />;
      case 'degraded':
        return <AlertCircle className='w-4 h-4 text-yellow-500' />;
      case 'unhealthy':
        return <XCircle className='w-4 h-4 text-red-500' />;
      case 'stopped':
        return <Activity className='w-4 h-4 text-gray-500' />;
      default:
        return <Activity className='w-4 h-4 text-gray-500' />;
    }
  };

  const handleOpenStudio = useCallback(async (instance: SupabaseInstance) => {
    const isCloud = instance.stackType === 'cloud';

    if (!isCloud) {
      const url = instance.credentials.studio_url || `http://${window.location.hostname}:${instance.ports.studio}`;
      window.open(url, '_blank');
      return;
    }

    setStudioActivating(instance.name);
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
    } finally {
      setStudioActivating(null);
    }
  }, []);

  if (isLoading) {
    return (
      <div className='flex items-center justify-center h-[calc(100vh-4rem)]'>
        <Loader2 className='w-8 h-8 animate-spin text-brand-500' />
      </div>
    );
  }

  return (
    <div className='h-[calc(100vh-4rem)] max-sm:h-[calc(100svh-8rem)]'>
      <div className='flex h-full flex-col md:flex-row'>
        {/* Left: Project List – on mobile hidden when a project is selected */}
        <div
          className={`md:w-80 md:border-r md:border-b-0 border-b border-white/5 flex flex-col md:flex-shrink-0 ${
            selectedProject ? 'hidden md:flex' : 'flex flex-1 md:flex-none'
          }`}
        >
          {/* Search */}
          <div className='p-4 border-b border-white/5'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground' />
              <input
                type='text'
                placeholder='Search projects...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='w-full pl-9 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm 
                  placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500/50'
              />
            </div>
            <p className='text-xs text-muted-foreground mt-2'>
              {filteredInstances?.length || 0} project{(filteredInstances?.length || 0) !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Project List */}
          <div className='flex-1 overflow-y-auto'>
            {filteredInstances?.length === 0 ? (
              <div className='flex flex-col items-center justify-center p-8 text-center'>
                <FolderKanban className='w-10 h-10 text-muted-foreground/30 mb-3' />
                <p className='text-sm text-muted-foreground'>No projects found</p>
              </div>
            ) : (
              filteredInstances?.map((instance) => (
                <button
                  key={instance.name}
                  onClick={() => {
                    setSelectedProject(instance.name);
                    setActiveTab('overview');
                  }}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-white/5 group ${
                    selectedProject === instance.name
                      ? 'bg-brand-500/10 border-l-2 border-l-brand-500'
                      : 'hover:bg-white/5 border-l-2 border-l-transparent'
                  }`}
                >
                  <div className='flex-shrink-0'>{getHealthIcon(instance.health?.overall || instance.status)}</div>
                  <div className='flex-1 min-w-0'>
                    <div className='flex items-center gap-2'>
                      <span className='text-sm font-medium text-foreground truncate'>{instance.name}</span>
                      {instance.stackType === 'cloud' && <Cloud className='w-3 h-3 text-brand-400 flex-shrink-0' />}
                    </div>
                    <p className='text-xs text-muted-foreground truncate'>
                      {instance.status === 'running' || instance.status === 'healthy'
                        ? 'Running'
                        : instance.status === 'stopped'
                          ? 'Stopped'
                          : instance.status}
                    </p>
                  </div>
                  <ChevronRight
                    className={`w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors ${
                      selectedProject === instance.name ? 'text-brand-400' : ''
                    }`}
                  />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Right: Detail Panel – on mobile hidden when nothing is selected */}
        <div className={`flex-1 overflow-y-auto ${!selectedProject ? 'hidden md:block' : 'block'}`}>
          {!selected ? (
            <div className='flex flex-col items-center justify-center h-full text-center p-8'>
              <div className='w-16 h-16 rounded-2xl bg-brand-500/10 flex items-center justify-center mb-4'>
                <FolderKanban className='w-8 h-8 text-brand-500/50' />
              </div>
              <h3 className='text-lg font-semibold text-foreground mb-2'>Select a Project</h3>
              <p className='text-sm text-muted-foreground max-w-sm'>
                Choose a project from the list to view its details, open Studio, manage keys, or configure SMTP.
              </p>
            </div>
          ) : (
            <div className='p-4 md:p-6'>
              {/* Mobile: back button */}
              <button
                onClick={() => setSelectedProject(null)}
                className='md:hidden flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors'
              >
                <ChevronLeft className='w-4 h-4' />
                All Projects
              </button>

              {/* Project Header */}
              <div className='flex flex-col gap-3 mb-6 sm:flex-row sm:items-start sm:justify-between'>
                <div>
                  <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center flex-shrink-0'>
                      <Database className='w-5 h-5 text-brand-400' />
                    </div>
                    <div className='min-w-0'>
                      <h2 className='text-xl md:text-2xl font-bold text-foreground truncate'>{selected.name}</h2>
                      <p className='text-sm text-muted-foreground truncate'>{selected.credentials?.project_url}</p>
                    </div>
                  </div>
                </div>
                <div className='flex items-center gap-2 flex-wrap'>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      selected.health?.overall === 'healthy' || selected.status === 'running'
                        ? 'bg-green-500/15 text-green-400'
                        : selected.health?.overall === 'degraded'
                          ? 'bg-yellow-500/15 text-yellow-400'
                          : selected.status === 'stopped'
                            ? 'bg-gray-500/15 text-gray-400'
                            : 'bg-red-500/15 text-red-400'
                    }`}
                  >
                    {getHealthIcon(selected.health?.overall || selected.status)}
                    {selected.health?.overall === 'healthy' || selected.status === 'running'
                      ? 'Healthy'
                      : selected.health?.overall === 'degraded'
                        ? 'Degraded'
                        : selected.status === 'stopped'
                          ? 'Stopped'
                          : 'Unhealthy'}
                  </span>
                  {selected.stackType === 'cloud' && (
                    <span className='inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-brand-500/15 text-brand-400'>
                      <Cloud className='w-3 h-3' />
                      Cloud
                    </span>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className='grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-6'>
                {/* Open Studio */}
                <button
                  onClick={() => handleOpenStudio(selected)}
                  disabled={studioActivating === selected.name || selected.status === 'stopped'}
                  className='flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 rounded-xl bg-brand-500/10 border border-brand-500/20 
                    hover:bg-brand-500/20 hover:border-brand-500/30 transition-all group disabled:opacity-50 disabled:cursor-not-allowed'
                >
                  {studioActivating === selected.name ? (
                    <Loader2 className='w-5 h-5 animate-spin text-brand-400 flex-shrink-0' />
                  ) : (
                    <ExternalLink className='w-5 h-5 text-brand-400 group-hover:scale-110 transition-transform flex-shrink-0' />
                  )}
                  <div className='text-left min-w-0'>
                    <p className='text-sm font-medium text-foreground'>Open Studio</p>
                    <p className='text-xs text-muted-foreground hidden sm:block'>Supabase Dashboard</p>
                  </div>
                </button>

                {/* Supabase Manager */}
                <button
                  onClick={() => setActiveTab('manager')}
                  className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 rounded-xl border transition-all group ${
                    activeTab === 'manager'
                      ? 'bg-blue-500/20 border-blue-500/30'
                      : 'bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20 hover:border-blue-500/30'
                  }`}
                >
                  <Code className='w-5 h-5 text-blue-400 group-hover:scale-110 transition-transform flex-shrink-0' />
                  <div className='text-left min-w-0'>
                    <p className='text-sm font-medium text-foreground'>Manager</p>
                    <p className='text-xs text-muted-foreground hidden sm:block'>DB, Functions, Storage</p>
                  </div>
                </button>

                {/* API Keys */}
                <button
                  onClick={() => setKeysModalInstance(selected)}
                  className='flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 rounded-xl bg-purple-500/10 border border-purple-500/20 
                    hover:bg-purple-500/20 hover:border-purple-500/30 transition-all group'
                >
                  <Key className='w-5 h-5 text-purple-400 group-hover:scale-110 transition-transform flex-shrink-0' />
                  <div className='text-left min-w-0'>
                    <p className='text-sm font-medium text-foreground'>API Keys</p>
                    <p className='text-xs text-muted-foreground hidden sm:block'>Anon, Service Role, JWT</p>
                  </div>
                </button>

                {/* SMTP */}
                <button
                  onClick={() => setActiveTab('smtp')}
                  className={`flex items-center gap-2 sm:gap-3 px-3 sm:px-4 py-3 rounded-xl border transition-all group ${
                    activeTab === 'smtp'
                      ? 'bg-orange-500/20 border-orange-500/30'
                      : 'bg-orange-500/10 border-orange-500/20 hover:bg-orange-500/20 hover:border-orange-500/30'
                  }`}
                >
                  <Mail className='w-5 h-5 text-orange-400 group-hover:scale-110 transition-transform flex-shrink-0' />
                  <div className='text-left min-w-0'>
                    <p className='text-sm font-medium text-foreground'>SMTP Settings</p>
                    <p className='text-xs text-muted-foreground hidden sm:block'>Email configuration</p>
                  </div>
                </button>
              </div>

              {/* Tab Content */}
              <div className='flex items-center gap-1 mb-4 border-b border-white/5 pb-px overflow-x-auto scrollbar-none'>
                <button
                  onClick={() => setActiveTab('overview')}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                    activeTab === 'overview'
                      ? 'text-brand-400 border-b-2 border-brand-500 bg-brand-500/5'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Overview
                </button>
                <button
                  onClick={() => setActiveTab('manager')}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                    activeTab === 'manager'
                      ? 'text-brand-400 border-b-2 border-brand-500 bg-brand-500/5'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span className='flex items-center gap-1.5'>
                    <Code className='w-3.5 h-3.5' /> Manager
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('smtp')}
                  className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                    activeTab === 'smtp'
                      ? 'text-brand-400 border-b-2 border-brand-500 bg-brand-500/5'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  SMTP
                </button>
              </div>

              {activeTab === 'overview' && (
                <div className='space-y-4'>
                  {/* Connection Info */}
                  <div className='glass-card p-5'>
                    <h3 className='text-sm font-semibold text-foreground mb-3 flex items-center gap-2'>
                      <Server className='w-4 h-4 text-primary' />
                      Connection Details
                    </h3>
                    <div className='space-y-3'>
                      <div>
                        <label className='text-xs text-muted-foreground'>Project URL</label>
                        <div className='flex items-center gap-2 mt-1'>
                          <code className='flex-1 text-sm bg-white/5 px-3 py-2 rounded-lg text-foreground font-mono truncate'>
                            {selected.credentials?.project_url || '—'}
                          </code>
                          <CopyButton text={selected.credentials?.project_url} />
                        </div>
                      </div>
                      <div>
                        <label className='text-xs text-muted-foreground'>Studio URL</label>
                        <div className='flex items-center gap-2 mt-1'>
                          <code className='flex-1 text-sm bg-white/5 px-3 py-2 rounded-lg text-foreground font-mono truncate'>
                            {selected.credentials?.studio_url || '—'}
                          </code>
                          <CopyButton text={selected.credentials?.studio_url} />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Services Summary */}
                  <div className='glass-card p-5'>
                    <h3 className='text-sm font-semibold text-foreground mb-3 flex items-center gap-2'>
                      <Activity className='w-4 h-4 text-primary' />
                      Services
                    </h3>
                    <div className='grid grid-cols-2 sm:grid-cols-3 gap-2'>
                      {selected.services?.map((svc) => (
                        <div key={svc.name} className='flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-sm'>
                          <div
                            className={`w-2 h-2 rounded-full flex-shrink-0 ${
                              svc.status === 'running' || svc.health === 'healthy'
                                ? 'bg-green-500'
                                : svc.status === 'stopped'
                                  ? 'bg-gray-500'
                                  : 'bg-red-500'
                            }`}
                          />
                          <span className='truncate text-muted-foreground'>{svc.name}</span>
                        </div>
                      )) || <p className='text-sm text-muted-foreground col-span-3'>No service data available</p>}
                    </div>
                  </div>

                  {/* Quick Info */}
                  <div className='glass-card p-5'>
                    <h3 className='text-sm font-semibold text-foreground mb-3'>Quick Info</h3>
                    <div className='grid grid-cols-2 gap-4 text-sm'>
                      <div>
                        <span className='text-muted-foreground'>Stack Type</span>
                        <p className='text-foreground font-medium mt-0.5'>
                          {selected.stackType === 'cloud' ? 'Cloud (Shared)' : 'Classic (Dedicated)'}
                        </p>
                      </div>
                      <div>
                        <span className='text-muted-foreground'>Gateway Port</span>
                        <p className='text-foreground font-medium mt-0.5'>{selected.ports?.gateway_port || '—'}</p>
                      </div>
                      <div>
                        <span className='text-muted-foreground'>Postgres Port</span>
                        <p className='text-foreground font-medium mt-0.5'>{selected.ports?.postgres || '—'}</p>
                      </div>
                      <div>
                        <span className='text-muted-foreground'>Created</span>
                        <p className='text-foreground font-medium mt-0.5'>
                          {selected.createdAt ? new Date(selected.createdAt).toLocaleDateString() : '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'manager' && <WorkspaceManagerPanel instanceName={selected.name} />}

              {activeTab === 'smtp' && <WorkspaceSmtpPanel instance={selected} />}
            </div>
          )}
        </div>
      </div>

      {/* Keys Modal */}
      {keysModalInstance && <KeysQuickModal instance={keysModalInstance} onClose={() => setKeysModalInstance(null)} />}
    </div>
  );
}

// Inline copy button component
function CopyButton({ text }: { text?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!text) return;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      disabled={!text}
      className='px-2 py-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-xs text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0'
      title='Copy'
    >
      {copied ? '✓' : 'Copy'}
    </button>
  );
}
