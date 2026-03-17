import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInstances } from '../hooks/useInstances';
import { useQueryClient } from '@tanstack/react-query';
import { useOrg } from '../contexts/OrgContext';
import OrgSwitcher from '../components/OrgSwitcher';
import KeysQuickModal from '../components/workspace/KeysQuickModal';
import { instancesApi } from '../lib/api';
import {
  Search,
  Plus,
  Database,
  Cloud,
  ExternalLink,
  Code,
  Key,
  ChevronLeft,
  FolderKanban,
  Loader2,
  CheckCircle,
  AlertCircle,
  XCircle,
  Activity,
  MoreVertical,
  Tag,
  Copy,
} from 'lucide-react';
import { toast } from 'sonner';
import type { SupabaseInstance } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function StatusBadge({ status }: { status: string }) {
  if (status === 'running' || status === 'healthy') {
    return (
      <span className='flex items-center gap-1 text-xs text-green-400'>
        <CheckCircle className='w-3 h-3' /> Healthy
      </span>
    );
  }
  if (status === 'degraded') {
    return (
      <span className='flex items-center gap-1 text-xs text-yellow-400'>
        <AlertCircle className='w-3 h-3' /> Degraded
      </span>
    );
  }
  if (status === 'stopped') {
    return (
      <span className='flex items-center gap-1 text-xs text-gray-400'>
        <Activity className='w-3 h-3' /> Stopped
      </span>
    );
  }
  return (
    <span className='flex items-center gap-1 text-xs text-red-400'>
      <XCircle className='w-3 h-3' /> Unhealthy
    </span>
  );
}

const ENV_CONFIG = {
  production: { label: 'Production', color: 'bg-red-500/15 text-red-400 border-red-500/20' },
  staging:    { label: 'Staging',    color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/20' },
  dev:        { label: 'Dev',        color: 'bg-blue-500/15 text-blue-400 border-blue-500/20' },
  preview:    { label: 'Preview',    color: 'bg-purple-500/15 text-purple-400 border-purple-500/20' },
} as const;

function EnvironmentBadge({ env }: { env: string | null | undefined }) {
  if (!env) return null;
  const cfg = ENV_CONFIG[env as keyof typeof ENV_CONFIG];
  if (!cfg) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${cfg.color}`}>
      <Tag className='w-2.5 h-2.5' />
      {cfg.label}
    </span>
  );
}

export default function WorkspaceProjectsPage() {
  const navigate = useNavigate();
  const { activeOrg } = useOrg();
  const { data: instances, isLoading } = useInstances();
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState('');
  const [keysModal, setKeysModal] = useState<SupabaseInstance | null>(null);
  const [studioActivating, setStudioActivating] = useState<string | null>(null);
  const [envMenuOpen, setEnvMenuOpen] = useState<string | null>(null); // instance name
  const [cloneModal, setCloneModal] = useState<{ source: SupabaseInstance; targetEnv: 'staging' | 'dev' } | null>(null);
  const [cloneName, setCloneName] = useState('');
  const [cloning, setCloning] = useState(false);

  const filtered =
    instances?.filter(
      (i) =>
        i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.credentials?.project_url?.toLowerCase().includes(searchQuery.toLowerCase())
    ) ?? [];

  const handleSetEnvironment = async (instance: SupabaseInstance, env: 'production' | 'staging' | 'dev' | 'preview' | null) => {
    setEnvMenuOpen(null);
    try {
      await instancesApi.setEnvironment(instance.name, env);
      toast.success(env ? `Environment set to "${env}"` : 'Environment label cleared');
      queryClient.invalidateQueries({ queryKey: ['instances'] });
    } catch (err: any) {
      toast.error('Failed to set environment', { description: err.message });
    }
  };

  const openCloneModal = (source: SupabaseInstance, targetEnv: 'staging' | 'dev') => {
    setEnvMenuOpen(null);
    setCloneName(`${source.name}-${targetEnv}`);
    setCloneModal({ source, targetEnv });
  };

  const handleClone = async () => {
    if (!cloneModal || !cloneName.trim()) return;
    setCloning(true);
    try {
      await instancesApi.clone(cloneModal.source.name, cloneName.trim(), { copyEnv: true });
      await instancesApi.setEnvironment(cloneName.trim(), cloneModal.targetEnv);
      toast.success(`Cloned as "${cloneName}" (${cloneModal.targetEnv})`);
      setCloneModal(null);
      queryClient.invalidateQueries({ queryKey: ['instances'] });
    } catch (err: any) {
      toast.error('Clone failed', { description: err.message });
    } finally {
      setCloning(false);
    }
  };

  const handleOpenStudio = useCallback(
    async (instance: SupabaseInstance, e: React.MouseEvent) => {
      e.stopPropagation();
      if (instance.status === 'stopped') return;
      const isCloud = instance.stackType === 'cloud';
      if (!isCloud) {
        const url =
          instance.credentials.studio_url ||
          `http://${window.location.hostname}:${instance.ports?.studio}`;
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
        const data = await res.json();
        window.open(data.studioUrl || `http://${window.location.hostname}:3000`, '_blank');
      } catch {
        // fail silently
      } finally {
        setStudioActivating(null);
      }
    },
    []
  );

  return (
    <div className='min-h-[calc(100vh-4rem)]'>
      {/* Page Header */}
      <div className='sticky top-16 z-10 border-b border-white/5 bg-background/80 backdrop-blur-md'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4'>
          <div className='flex items-center gap-3 min-w-0'>
            <button
              onClick={() => navigate('/workspace')}
              className='flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors flex-shrink-0'
            >
              <ChevronLeft className='w-4 h-4' />
            </button>
            <div className='min-w-0'>
              <div className='flex items-center gap-2'>
                <h1 className='text-lg font-bold text-foreground'>Projects</h1>
                <OrgSwitcher />
              </div>
              <p className='text-xs text-muted-foreground hidden sm:block'>
                {filtered.length} project{filtered.length !== 1 ? 's' : ''}
                {activeOrg ? ` in ${activeOrg.name}` : ''}
              </p>
            </div>
          </div>

          <div className='flex items-center gap-2 flex-shrink-0'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground' />
              <input
                type='text'
                placeholder='Search...'
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className='pl-8 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-brand-500/50 w-24 sm:w-36 lg:w-48'
              />
            </div>
            <button
              onClick={() => navigate('/dashboard')}
              className='flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 text-white rounded-lg text-sm font-medium hover:bg-brand-600 transition-colors'
            >
              <Plus className='w-3.5 h-3.5' />
              <span className='hidden sm:inline'>New Project</span>
            </button>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className='max-w-7xl mx-auto px-4 sm:px-6 py-8'>
        {isLoading ? (
          <div className='flex justify-center py-20'>
            <Loader2 className='w-8 h-8 animate-spin text-brand-500' />
          </div>
        ) : filtered.length === 0 ? (
          <div className='text-center py-20'>
            <div className='w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4'>
              <FolderKanban className='w-8 h-8 text-muted-foreground/40' />
            </div>
            <h3 className='text-lg font-semibold mb-2'>
              {searchQuery ? 'No matching projects' : 'No projects yet'}
            </h3>
            <p className='text-sm text-muted-foreground'>
              {searchQuery
                ? 'Try a different search term'
                : 'Create your first project from the Dashboard'}
            </p>
          </div>
        ) : (
          <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5'>
            {filtered.map((instance) => {
              const health = instance.health?.overall || instance.status;
              return (
                <div
                  key={instance.name}
                  onClick={() => navigate(`/workspace/projects/${instance.name}`)}
                  className='flex flex-col p-5 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-brand-500/20 cursor-pointer transition-all group'
                >
                  {/* Card Header */}
                  <div className='flex items-start justify-between mb-3'>
                    <div className='w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center flex-shrink-0'>
                      <Database className='w-5 h-5 text-brand-400' />
                    </div>
                    <div className='flex items-center gap-1.5'>
                      {instance.stackType === 'cloud' && (
                        <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-500/10 text-brand-400'>
                          <Cloud className='w-3 h-3' /> Cloud
                        </span>
                      )}
                      {/* Environment context menu */}
                      <div className='relative' onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => setEnvMenuOpen(envMenuOpen === instance.name ? null : instance.name)}
                          className='p-1 rounded hover:bg-white/10 text-muted-foreground transition-colors'
                          title='Environment & Clone'
                        >
                          <MoreVertical className='w-3.5 h-3.5' />
                        </button>
                        {envMenuOpen === instance.name && (
                          <div className='absolute right-0 top-7 z-20 w-52 bg-popover border border-white/10 rounded-xl shadow-2xl py-1 text-sm animate-in slide-in-from-top-2'>
                            <div className='px-3 py-1.5 text-[11px] text-muted-foreground font-medium uppercase tracking-wide'>Set Environment</div>
                            {(['production', 'staging', 'dev', 'preview'] as const).map((env) => (
                              <button
                                key={env}
                                onClick={() => handleSetEnvironment(instance, env)}
                                className={`w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 transition-colors ${instance.environment === env ? 'text-brand-400' : ''}`}
                              >
                                <Tag className='w-3.5 h-3.5 flex-shrink-0' />
                                <span className='capitalize'>{env}</span>
                                {instance.environment === env && <span className='ml-auto text-brand-400'>✓</span>}
                              </button>
                            ))}
                            <button
                              onClick={() => handleSetEnvironment(instance, null)}
                              className='w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 transition-colors text-muted-foreground'
                            >
                              <XCircle className='w-3.5 h-3.5 flex-shrink-0' /> Clear label
                            </button>
                            <div className='border-t border-white/5 my-1' />
                            <div className='px-3 py-1.5 text-[11px] text-muted-foreground font-medium uppercase tracking-wide'>Clone As</div>
                            <button
                              onClick={() => openCloneModal(instance, 'staging')}
                              className='w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 transition-colors'
                            >
                              <Copy className='w-3.5 h-3.5 flex-shrink-0' /> Clone as Staging
                            </button>
                            <button
                              onClick={() => openCloneModal(instance, 'dev')}
                              className='w-full flex items-center gap-2 px-3 py-1.5 hover:bg-white/5 transition-colors'
                            >
                              <Copy className='w-3.5 h-3.5 flex-shrink-0' /> Clone as Dev
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className='flex items-center gap-2 mb-1'>
                    <p className='font-semibold text-foreground truncate'>{instance.name}</p>
                    <EnvironmentBadge env={instance.environment} />
                  </div>
                  <StatusBadge status={health} />
                  <p className='text-xs text-muted-foreground font-mono truncate mt-2 mb-4'>
                    {instance.credentials?.project_url || 'No URL configured'}
                  </p>

                  {/* Actions */}
                  <div className='flex items-center gap-1.5 mt-auto pt-3 border-t border-white/5'>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/workspace/projects/${instance.name}`);
                      }}
                      className='flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 text-xs font-medium transition-colors'
                    >
                      <Code className='w-3.5 h-3.5' />
                      Manager
                    </button>
                    <button
                      onClick={(e) => handleOpenStudio(instance, e)}
                      disabled={studioActivating === instance.name || instance.status === 'stopped'}
                      className='flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground text-xs font-medium transition-colors disabled:opacity-40'
                    >
                      {studioActivating === instance.name ? (
                        <Loader2 className='w-3.5 h-3.5 animate-spin' />
                      ) : (
                        <ExternalLink className='w-3.5 h-3.5' />
                      )}
                      Studio
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setKeysModal(instance);
                      }}
                      className='flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white/5 text-muted-foreground hover:bg-white/10 hover:text-foreground text-xs font-medium transition-colors ml-auto'
                    >
                      <Key className='w-3.5 h-3.5' />
                      Keys
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {keysModal && <KeysQuickModal instance={keysModal} onClose={() => setKeysModal(null)} />}

      {/* Overlay to close env menu */}
      {envMenuOpen && (
        <div className='fixed inset-0 z-10' onClick={() => setEnvMenuOpen(null)} />
      )}

      {/* Clone Modal */}
      {cloneModal && (
        <div className='fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4'>
          <div className='bg-background border border-white/10 rounded-xl shadow-2xl p-6 w-full max-w-md space-y-4 animate-in slide-in-from-top-2'>
            <h3 className='text-base font-semibold flex items-center gap-2'>
              <Copy className='w-5 h-5 text-brand-400' />
              Clone "{cloneModal.source.name}" as {cloneModal.targetEnv}
            </h3>
            <p className='text-sm text-muted-foreground'>
              A full copy of the instance will be created, including all environment variables.
              The clone will be labelled <strong className='text-foreground'>{cloneModal.targetEnv}</strong>.
            </p>
            <div>
              <label className='text-xs font-medium text-muted-foreground'>New instance name</label>
              <input
                type='text'
                value={cloneName}
                onChange={(e) => setCloneName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                className='mt-1 w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm font-mono focus:outline-none focus:border-brand-400'
              />
            </div>
            <div className='flex gap-2 justify-end pt-1'>
              <button
                onClick={() => setCloneModal(null)}
                disabled={cloning}
                className='px-3 py-2 text-sm rounded-md hover:bg-white/5 transition-colors'
              >
                Cancel
              </button>
              <button
                onClick={handleClone}
                disabled={cloning || !cloneName.trim()}
                className='flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-brand-500 hover:bg-brand-600 text-white font-medium transition-colors disabled:opacity-50'
              >
                {cloning ? <Loader2 className='w-4 h-4 animate-spin' /> : <Copy className='w-4 h-4' />}
                Clone
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
