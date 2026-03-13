import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useInstances } from '../hooks/useInstances';
import { useOrg } from '../contexts/OrgContext';
import OrgSwitcher from '../components/OrgSwitcher';
import KeysQuickModal from '../components/workspace/KeysQuickModal';
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
} from 'lucide-react';
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

export default function WorkspaceProjectsPage() {
  const navigate = useNavigate();
  const { activeOrg } = useOrg();
  const { data: instances, isLoading } = useInstances();
  const [searchQuery, setSearchQuery] = useState('');
  const [keysModal, setKeysModal] = useState<SupabaseInstance | null>(null);
  const [studioActivating, setStudioActivating] = useState<string | null>(null);

  const filtered =
    instances?.filter(
      (i) =>
        i.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        i.credentials?.project_url?.toLowerCase().includes(searchQuery.toLowerCase())
    ) ?? [];

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
                className='pl-8 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-brand-500/50 w-36 sm:w-48'
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
                    {instance.stackType === 'cloud' && (
                      <span className='inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-brand-500/10 text-brand-400'>
                        <Cloud className='w-3 h-3' /> Cloud
                      </span>
                    )}
                  </div>

                  <p className='font-semibold text-foreground truncate mb-1'>{instance.name}</p>
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
    </div>
  );
}
