import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { domainsApi } from '../../lib/api';
import {
  Globe,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  Loader2,
  Copy,
  Check,
  ShieldCheck,
  Terminal,
} from 'lucide-react';
import { toast } from 'sonner';
import type { SupabaseInstance } from '../../types';

interface DomainsPanelProps {
  instance: SupabaseInstance;
}

type DomainStatus = 'pending_dns' | 'dns_verified' | 'ssl_pending' | 'ssl_active' | 'error';

interface CustomDomain {
  id: number;
  instanceName: string;
  domain: string;
  status: DomainStatus;
  errorMsg: string | null;
  createdAt: string;
}

function StatusBadge({ status }: { status: DomainStatus }) {
  switch (status) {
    case 'pending_dns':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">
          <Clock className="w-3 h-3" /> Awaiting DNS
        </span>
      );
    case 'dns_verified':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20">
          <CheckCircle className="w-3 h-3" /> DNS Verified
        </span>
      );
    case 'ssl_pending':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20">
          <Loader2 className="w-3 h-3 animate-spin" /> SSL Pending
        </span>
      );
    case 'ssl_active':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-500/10 text-green-400 border border-green-500/20">
          <ShieldCheck className="w-3 h-3" /> Active (SSL)
        </span>
      );
    case 'error':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-500/10 text-red-400 border border-red-500/20">
          <XCircle className="w-3 h-3" /> Error
        </span>
      );
    default:
      return null;
  }
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-white/10 transition-colors text-muted-foreground hover:text-foreground"
      title="Copy"
    >
      {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export default function DomainsPanel({ instance }: DomainsPanelProps) {
  const queryClient = useQueryClient();
  const [newDomain, setNewDomain] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [showSslModal, setShowSslModal] = useState<string | null>(null); // domain string

  const { data, isLoading, isRefetching, refetch } = useQuery({
    queryKey: ['domains', instance.name],
    queryFn: () => domainsApi.list(instance.name),
  });

  const addMutation = useMutation({
    mutationFn: (domain: string) => domainsApi.add(instance.name, domain),
    onSuccess: () => {
      toast.success('Domain added. Set the DNS record shown below.');
      setNewDomain('');
      queryClient.invalidateQueries({ queryKey: ['domains', instance.name] });
    },
    onError: (error: any) => {
      toast.error('Failed to add domain', { description: error.message });
    },
  });

  const checkDnsMutation = useMutation({
    mutationFn: (domain: string) => domainsApi.checkDns(instance.name, domain),
    onSuccess: (result) => {
      if (result.verified) {
        toast.success(result.message);
      } else {
        toast.warning(result.message);
      }
      queryClient.invalidateQueries({ queryKey: ['domains', instance.name] });
    },
    onError: (error: any) => {
      toast.error('DNS check failed', { description: error.message });
    },
  });

  const activateSslMutation = useMutation({
    mutationFn: ({ domain, email }: { domain: string; email: string }) =>
      domainsApi.activateSsl(instance.name, domain, email),
    onSuccess: (result) => {
      toast.success(result.message || 'SSL activated!');
      setShowSslModal(null);
      queryClient.invalidateQueries({ queryKey: ['domains', instance.name] });
    },
    onError: (error: any) => {
      toast.error('SSL activation failed', { description: error.message });
    },
  });

  const manualActivateMutation = useMutation({
    mutationFn: (domain: string) => domainsApi.manualActivate(instance.name, domain),
    onSuccess: () => {
      toast.success('Domain activated! Nginx reloaded.');
      setShowSslModal(null);
      queryClient.invalidateQueries({ queryKey: ['domains', instance.name] });
    },
    onError: (error: any) => {
      toast.error('Activation failed', { description: error.message });
    },
  });

  const removeMutation = useMutation({
    mutationFn: (domain: string) => domainsApi.remove(instance.name, domain),
    onSuccess: () => {
      toast.success('Domain removed');
      queryClient.invalidateQueries({ queryKey: ['domains', instance.name] });
    },
    onError: (error: any) => {
      toast.error('Failed to remove domain', { description: error.message });
    },
  });

  const domains: CustomDomain[] = data?.domains ?? [];

  const defaultUrl =
    (instance as any)?.credentials?.project_url ||
    (instance as any)?.apiUrl ||
    '';

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newDomain.trim().toLowerCase();
    if (!trimmed) return;
    addMutation.mutate(trimmed);
  };

  const certbotCmd = (domain: string) =>
    `sudo certbot certonly --standalone --non-interactive --agree-tos --email admin@example.com -d ${domain}`;

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Globe className="w-5 h-5 text-brand-400" />
            Custom Domains
          </h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            Route custom hostnames to this project with automatic CNAME verification and SSL.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="p-2 hover:bg-secondary rounded-md transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${isRefetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Default URL info */}
      {defaultUrl && (
        <div className="glass-card p-4 flex items-center gap-3">
          <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-0.5">Default project URL</p>
            <p className="text-sm font-mono truncate">{defaultUrl}</p>
          </div>
        </div>
      )}

      {/* Add domain form */}
      <div className="glass-card p-5">
        <h4 className="text-sm font-medium mb-3">Add Custom Domain</h4>
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            type="text"
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            placeholder="api.your-company.com"
            className="flex-1 bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-brand-400 font-mono"
          />
          <button
            type="submit"
            disabled={addMutation.isPending || !newDomain.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white rounded-md text-sm font-medium transition-colors disabled:opacity-50"
          >
            {addMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Add Domain
          </button>
        </form>
        <p className="text-xs text-muted-foreground mt-2">
          After adding, you will need to create a CNAME record pointing to this server.
        </p>
      </div>

      {/* Domain list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading domains…
        </div>
      ) : domains.length === 0 ? (
        <div className="glass-card p-10 text-center text-muted-foreground">
          <Globe className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No custom domains yet.</p>
          <p className="text-xs mt-1">Add one above to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {domains.map((d) => (
            <DomainCard
              key={d.id}
              domain={d}
              certbotCmd={certbotCmd(d.domain)}
              onCheckDns={() => checkDnsMutation.mutate(d.domain)}
              onActivateSsl={() => setShowSslModal(d.domain)}
              onManualActivate={() => manualActivateMutation.mutate(d.domain)}
              onRemove={() => removeMutation.mutate(d.domain)}
              checkingDns={checkDnsMutation.isPending && checkDnsMutation.variables === d.domain}
              removing={removeMutation.isPending && removeMutation.variables === d.domain}
              manualActivating={manualActivateMutation.isPending && manualActivateMutation.variables === d.domain}
            />
          ))}
        </div>
      )}

      {/* SSL modal */}
      {showSslModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-white/10 rounded-xl shadow-2xl p-6 w-full max-w-md space-y-4 animate-in slide-in-from-top-2">
            <h3 className="text-base font-semibold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-brand-400" />
              Activate SSL for {showSslModal}
            </h3>
            <p className="text-sm text-muted-foreground">
              Multibase will run Certbot on the server to obtain a Let's Encrypt certificate. Make
              sure port 80 is open and DNS is already pointing here.
            </p>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Admin email (for Let's Encrypt)</label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="admin@your-company.com"
                className="mt-1 w-full bg-white/5 border border-white/10 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-brand-400"
              />
            </div>
            <div className="flex items-start gap-2 p-3 bg-white/5 rounded-md border border-white/10">
              <Terminal className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground mb-1">Or run manually on the server:</p>
                <p className="text-xs font-mono break-all">{certbotCmd(showSslModal)}</p>
              </div>
              <CopyButton value={certbotCmd(showSslModal)} />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button
                onClick={() => setShowSslModal(null)}
                className="px-3 py-2 text-sm rounded-md hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => manualActivateMutation.mutate(showSslModal)}
                disabled={manualActivateMutation.isPending}
                className="px-3 py-2 text-sm rounded-md bg-white/10 hover:bg-white/15 transition-colors"
              >
                Already ran – Activate nginx
              </button>
              <button
                onClick={() => activateSslMutation.mutate({ domain: showSslModal, email: adminEmail })}
                disabled={activateSslMutation.isPending || !adminEmail}
                className="flex items-center gap-2 px-4 py-2 text-sm rounded-md bg-brand-500 hover:bg-brand-600 text-white font-medium transition-colors disabled:opacity-50"
              >
                {activateSslMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldCheck className="w-4 h-4" />
                )}
                Run Certbot
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Domain Card ───────────────────────────────────────────────────────────────

interface DomainCardProps {
  domain: CustomDomain;
  certbotCmd: string;
  onCheckDns: () => void;
  onActivateSsl: () => void;
  onManualActivate: () => void;
  onRemove: () => void;
  checkingDns: boolean;
  removing: boolean;
  manualActivating: boolean;
}

function DomainCard({
  domain,
  certbotCmd,
  onCheckDns,
  onActivateSsl,
  onRemove,
  checkingDns,
  removing,
}: DomainCardProps) {
  const [showInstructions, setShowInstructions] = useState(false);

  return (
    <div className="glass-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Globe className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-mono font-medium truncate">{domain.domain}</p>
            <p className="text-xs text-muted-foreground">
              Added {new Date(domain.createdAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <StatusBadge status={domain.status as DomainStatus} />
          <button
            onClick={onRemove}
            disabled={removing}
            className="p-1.5 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
            title="Remove domain"
          >
            {removing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Trash2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Error message */}
      {domain.status === 'error' && domain.errorMsg && (
        <div className="flex items-start gap-2 p-2 bg-red-500/10 border border-red-500/20 rounded-md">
          <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-red-400">{domain.errorMsg}</p>
        </div>
      )}

      {/* DNS instructions */}
      {domain.status === 'pending_dns' && (
        <div className="space-y-2">
          <button
            onClick={() => setShowInstructions((v) => !v)}
            className="text-xs text-brand-400 hover:underline"
          >
            {showInstructions ? 'Hide' : 'Show'} DNS setup instructions
          </button>
          {showInstructions && (
            <div className="p-3 bg-white/5 border border-white/10 rounded-md space-y-2 text-xs">
              <p className="text-muted-foreground">
                Create a <strong>CNAME</strong> record in your DNS provider:
              </p>
              <div className="font-mono grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                <span className="text-muted-foreground">Type</span>
                <span>CNAME</span>
                <span className="text-muted-foreground">Name</span>
                <span className="flex items-center gap-1">
                  {domain.domain}
                  <CopyButton value={domain.domain} />
                </span>
                <span className="text-muted-foreground">Value</span>
                <span className="flex items-center gap-1 text-brand-400">
                  &lt;your server IP or hostname&gt;
                </span>
              </div>
              <p className="text-muted-foreground">
                DNS changes can take up to 48 hours to propagate worldwide.
              </p>
            </div>
          )}
          <div className="flex gap-2 mt-1">
            <button
              onClick={onCheckDns}
              disabled={checkingDns}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 border border-white/10 rounded-md transition-colors"
            >
              {checkingDns ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              Check DNS
            </button>
          </div>
        </div>
      )}

      {/* DNS verified — ready for SSL */}
      {domain.status === 'dns_verified' && (
        <div className="flex items-center gap-3">
          <div className="flex-1 p-2 bg-blue-500/10 border border-blue-500/20 rounded-md">
            <p className="text-xs text-blue-400">
              DNS verified! You can now issue an SSL certificate.
            </p>
          </div>
          <button
            onClick={onActivateSsl}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-brand-500 hover:bg-brand-600 text-white rounded-md transition-colors font-medium"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Activate SSL
          </button>
        </div>
      )}

      {/* Active — show certbot command for reference */}
      {domain.status === 'ssl_active' && (
        <div className="flex items-start gap-2 p-2 bg-green-500/10 border border-green-500/20 rounded-md">
          <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-green-400 font-medium">Domain active with SSL</p>
            <p className="text-xs text-muted-foreground truncate font-mono mt-0.5">
              https://{domain.domain}
            </p>
          </div>
          <CopyButton value={`https://${domain.domain}`} />
        </div>
      )}

      {/* Show certbot command for reference when ssl_active */}
      {domain.status === 'ssl_active' && (
        <details className="text-xs">
          <summary className="text-muted-foreground cursor-pointer hover:text-foreground select-none">
            Certbot renewal command
          </summary>
          <div className="mt-2 p-2 bg-white/5 border border-white/10 rounded font-mono flex items-start gap-2 break-all">
            <Terminal className="w-3.5 h-3.5 mt-0.5 flex-shrink-0 text-muted-foreground" />
            <span className="flex-1">{certbotCmd}</span>
            <CopyButton value={certbotCmd} />
          </div>
        </details>
      )}
    </div>
  );
}
