import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Package,
  Trash2,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
  ArrowUpCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { instanceExtensionsApi, type InstalledExtension } from '../lib/api';

interface ExtensionsTabProps {
  instanceName: string;
}

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  active: { icon: CheckCircle2, color: 'text-green-400', label: 'Active' },
  error: { icon: AlertCircle, color: 'text-red-400', label: 'Error' },
  updating: { icon: Clock, color: 'text-yellow-400', label: 'Updating' },
  disabled: { icon: XCircle, color: 'text-gray-400', label: 'Disabled' },
};

export default function ExtensionsTab({ instanceName }: ExtensionsTabProps) {
  const queryClient = useQueryClient();

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['installed-extensions', instanceName],
    queryFn: () => instanceExtensionsApi.list(instanceName),
  });

  const uninstallMutation = useMutation({
    mutationFn: (extensionId: string) => instanceExtensionsApi.uninstall(instanceName, extensionId),
    onSuccess: () => {
      toast.success('Extension uninstalled');
      queryClient.invalidateQueries({ queryKey: ['installed-extensions', instanceName] });
    },
    onError: (err: any) => toast.error('Uninstall failed', { description: err.message }),
  });

  const installedExtensions: InstalledExtension[] = data?.extensions ?? [];

  return (
    <div className='space-y-5'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-2'>
          <Package className='w-5 h-5 text-brand-400' />
          <h2 className='text-base font-semibold'>Installed Extensions</h2>
          {installedExtensions.length > 0 && (
            <span className='text-xs px-1.5 py-0.5 rounded-full bg-brand-500/15 text-brand-400'>
              {installedExtensions.length}
            </span>
          )}
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className='text-xs px-2.5 py-1.5 rounded border border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20 transition-colors flex items-center gap-1'
        >
          <RefreshCw className={`w-3 h-3 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* List */}
      {isLoading ? (
        <div className='flex items-center justify-center py-12'>
          <Loader2 className='w-5 h-5 animate-spin text-brand-400' />
        </div>
      ) : installedExtensions.length === 0 ? (
        <div className='text-center py-12 text-muted-foreground border border-white/5 rounded-xl bg-white/2'>
          <Package className='w-10 h-10 mx-auto mb-3 opacity-25' />
          <p className='text-sm font-medium mb-1'>No extensions installed</p>
          <p className='text-xs'>
            Visit the <strong>Marketplace</strong> in the sidebar to install extensions on this instance.
          </p>
        </div>
      ) : (
        <div className='space-y-2'>
          {installedExtensions.map((installed) => (
            <InstalledExtensionRow
              key={installed.id}
              installed={installed}
              onUninstall={() => uninstallMutation.mutate(installed.extensionId)}
              isUninstalling={uninstallMutation.isPending && uninstallMutation.variables === installed.extensionId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Installed Extension Row ───────────────────────────────────────────────────

function InstalledExtensionRow({
  installed,
  onUninstall,
  isUninstalling,
}: {
  installed: InstalledExtension;
  onUninstall: () => void;
  isUninstalling: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const statusCfg = STATUS_CONFIG[installed.status] ?? STATUS_CONFIG.disabled;
  const Icon = statusCfg.icon;

  return (
    <div className='flex items-center gap-3 p-3 rounded-xl border border-white/5 bg-white/2 hover:border-white/10 transition-colors'>
      <div className='w-8 h-8 rounded-lg bg-brand-500/10 flex items-center justify-center text-sm shrink-0 select-none'>
        🧩
      </div>
      <div className='flex-1 min-w-0'>
        <div className='flex items-center gap-2 flex-wrap'>
          <span className='text-sm font-medium truncate'>{installed.extension.name}</span>
          <span className={`flex items-center gap-0.5 text-xs ${statusCfg.color}`}>
            <Icon className='w-3 h-3' />
            {statusCfg.label}
          </span>
          {installed.extension.latestVersion && installed.extension.latestVersion !== installed.version && (
            <span className='flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-400/10 text-yellow-400 border border-yellow-400/20'>
              <ArrowUpCircle className='w-2.5 h-2.5' />
              Update {installed.extension.latestVersion}
            </span>
          )}
        </div>
        <div className='text-xs text-muted-foreground flex items-center gap-2 mt-0.5'>
          <span>v{installed.version}</span>
          <span>·</span>
          <span>by {installed.extension.author}</span>
          <span>·</span>
          <span>Installed {new Date(installed.installedAt).toLocaleDateString()}</span>
        </div>
      </div>

      {confirming ? (
        <div className='flex items-center gap-2 shrink-0'>
          <span className='text-xs text-muted-foreground'>Uninstall?</span>
          <button
            onClick={() => {
              onUninstall();
              setConfirming(false);
            }}
            disabled={isUninstalling}
            className='text-xs px-2.5 py-1 rounded bg-red-500/15 text-red-400 border border-red-500/20 hover:bg-red-500/25 transition-colors flex items-center gap-1'
          >
            {isUninstalling ? <Loader2 className='w-3 h-3 animate-spin' /> : <Trash2 className='w-3 h-3' />}
            Yes
          </button>
          <button
            onClick={() => setConfirming(false)}
            className='text-xs px-2.5 py-1 rounded border border-white/10 text-muted-foreground hover:text-foreground transition-colors'
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirming(true)}
          className='text-xs px-2.5 py-1 rounded border border-white/10 text-muted-foreground hover:text-red-400 hover:border-red-500/20 transition-colors flex items-center gap-1 shrink-0'
        >
          <Trash2 className='w-3 h-3' />
          Remove
        </button>
      )}
    </div>
  );
}
