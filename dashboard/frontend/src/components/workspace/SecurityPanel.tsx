import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { securityApi, SecurityConfig } from '../../lib/api';
import { ShieldCheck, Globe, Zap, AlertTriangle, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

interface SecurityPanelProps {
  instanceName: string;
}

function Toggle({
  enabled,
  onChange,
  label,
  description,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className='flex items-start justify-between gap-4'>
      <div>
        <p className='text-sm font-medium'>{label}</p>
        {description && <p className='text-xs text-muted-foreground mt-0.5'>{description}</p>}
      </div>
      <button
        type='button'
        role='switch'
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors focus:outline-none ${
          enabled ? 'bg-primary' : 'bg-white/10'
        }`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            enabled ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

export default function SecurityPanel({ instanceName }: SecurityPanelProps) {
  const [form, setForm] = useState<SecurityConfig>({
    sslOnly: false,
    ipWhitelistEnabled: false,
    ipWhitelist: '',
    rateLimitEnabled: false,
    rateLimitRpm: 300,
  });
  const [dirty, setDirty] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['security-config', instanceName],
    queryFn: () => securityApi.get(instanceName),
  });

  useEffect(() => {
    if (data) {
      setForm(data);
      setDirty(false);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: () => securityApi.update(instanceName, form),
    onSuccess: (res) => {
      toast.success(res.message || 'Security settings saved');
      setDirty(false);
    },
    onError: (err: any) => toast.error('Failed to save', { description: err.message }),
  });

  const update = (patch: Partial<SecurityConfig>) => {
    setForm((f) => ({ ...f, ...patch }));
    setDirty(true);
  };

  if (isLoading) {
    return (
      <div className='flex justify-center p-12'>
        <Loader2 className='w-6 h-6 animate-spin text-muted-foreground' />
      </div>
    );
  }

  return (
    <div className='space-y-6 max-w-2xl'>
      <div>
        <h2 className='text-lg font-semibold flex items-center gap-2'>
          <ShieldCheck className='w-5 h-5 text-brand-400' />
          Network Restrictions
        </h2>
        <p className='text-sm text-muted-foreground mt-0.5'>
          Settings are applied via nginx configuration and take effect immediately after saving.
        </p>
      </div>

      {/* SSL Enforcement */}
      <div className='glass-card p-4 space-y-4'>
        <div className='flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
          <Globe className='w-3.5 h-3.5' />
          SSL / HTTPS
        </div>
        <Toggle
          enabled={form.sslOnly}
          onChange={(v) => update({ sslOnly: v })}
          label='Enforce HTTPS-only access'
          description='Redirects all HTTP requests to HTTPS. Requires a valid SSL certificate on the instance.'
        />
      </div>

      {/* IP Whitelist */}
      <div className='glass-card p-4 space-y-4'>
        <div className='flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
          <ShieldCheck className='w-3.5 h-3.5' />
          IP Restrictions
        </div>
        <Toggle
          enabled={form.ipWhitelistEnabled}
          onChange={(v) => update({ ipWhitelistEnabled: v })}
          label='Enable IP Whitelist'
          description='Only listed IP addresses or CIDR ranges can reach the API. All others receive 403.'
        />
        {form.ipWhitelistEnabled && (
          <div className='space-y-2 animate-in slide-in-from-top-2'>
            <div className='flex items-start gap-2 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg p-3'>
              <AlertTriangle className='w-4 h-4 flex-shrink-0 mt-0.5' />
              <p>
                Make sure your own IP address is included before saving, or you will be locked out.
              </p>
            </div>
            <label className='text-xs text-muted-foreground'>
              Allowed IPs / CIDR ranges (comma-separated)
            </label>
            <textarea
              rows={4}
              className='w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-primary resize-none'
              placeholder={'1.2.3.4\n10.0.0.0/24\n192.168.1.0/28'}
              value={form.ipWhitelist.split(',').join('\n')}
              onChange={(e) =>
                update({
                  ipWhitelist: e.target.value
                    .split('\n')
                    .map((s) => s.trim())
                    .filter(Boolean)
                    .join(','),
                })
              }
            />
          </div>
        )}
      </div>

      {/* Rate Limiting */}
      <div className='glass-card p-4 space-y-4'>
        <div className='flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground'>
          <Zap className='w-3.5 h-3.5' />
          Rate Limiting
        </div>
        <Toggle
          enabled={form.rateLimitEnabled}
          onChange={(v) => update({ rateLimitEnabled: v })}
          label='Enable API Rate Limiting'
          description='Limits requests per minute per IP address via nginx limit_req.'
        />
        {form.rateLimitEnabled && (
          <div className='flex items-center gap-3 animate-in slide-in-from-top-2'>
            <label className='text-sm text-muted-foreground whitespace-nowrap'>
              Requests / minute
            </label>
            <input
              type='number'
              min={10}
              max={10000}
              step={10}
              className='w-28 bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-primary'
              value={form.rateLimitRpm}
              onChange={(e) => update({ rateLimitRpm: parseInt(e.target.value, 10) || 300 })}
            />
            <span className='text-xs text-muted-foreground'>Default: 300 req/min</span>
          </div>
        )}
      </div>

      {/* Save */}
      <div className='flex justify-end'>
        <button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || !dirty}
          className='flex items-center gap-2 px-5 py-2 text-sm bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50'
        >
          {saveMutation.isPending ? (
            <Loader2 className='w-4 h-4 animate-spin' />
          ) : (
            <Save className='w-4 h-4' />
          )}
          Save & Apply
        </button>
      </div>
    </div>
  );
}
