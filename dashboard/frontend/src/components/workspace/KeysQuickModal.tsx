import { useState } from 'react';
import type { SupabaseInstance } from '../../types';
import { X, Copy, Check, Eye, EyeOff, Key, Shield, Lock, Database } from 'lucide-react';

interface KeysQuickModalProps {
  instance: SupabaseInstance;
  onClose: () => void;
}

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
    <div className='group'>
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
              title={visible ? 'Hide' : 'Show'}
            >
              {visible ? <EyeOff className='w-3.5 h-3.5' /> : <Eye className='w-3.5 h-3.5' />}
            </button>
          )}
          <button
            onClick={handleCopy}
            disabled={!value}
            className='p-1 rounded text-muted-foreground/50 hover:text-brand-400 transition-colors disabled:opacity-30'
            title='Copy'
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

export default function KeysQuickModal({ instance, onClose }: KeysQuickModalProps) {
  const creds = instance.credentials;

  return (
    <div className='fixed inset-0 z-[100] flex items-center justify-center'>
      {/* Backdrop */}
      <div className='absolute inset-0 bg-black/60 backdrop-blur-sm' onClick={onClose} />

      {/* Modal */}
      <div className='relative w-full max-w-lg mx-4 rounded-2xl border border-white/10 bg-card/95 backdrop-blur-xl shadow-2xl'>
        {/* Header */}
        <div className='flex items-center justify-between px-6 py-4 border-b border-white/10'>
          <div className='flex items-center gap-3'>
            <div className='w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center'>
              <Key className='w-4 h-4 text-purple-400' />
            </div>
            <div>
              <h3 className='text-base font-semibold text-foreground'>API Keys</h3>
              <p className='text-xs text-muted-foreground'>{instance.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className='p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors'
          >
            <X className='w-5 h-5' />
          </button>
        </div>

        {/* Content */}
        <div className='px-6 py-5 space-y-4 max-h-[70vh] overflow-y-auto'>
          <KeyField
            label='Anon Key (public)'
            value={creds?.anon_key || ''}
            icon={<Key className='w-3 h-3' />}
            sensitive={false}
          />
          <KeyField
            label='Service Role Key (secret)'
            value={creds?.service_role_key || ''}
            icon={<Shield className='w-3 h-3' />}
          />
          <KeyField label='JWT Secret' value={creds?.jwt_secret || ''} icon={<Lock className='w-3 h-3' />} />
          <KeyField
            label='Postgres Password'
            value={creds?.postgres_password || ''}
            icon={<Database className='w-3 h-3' />}
          />

          {/* Connection snippets */}
          <div className='pt-2 border-t border-white/10'>
            <p className='text-xs font-medium text-muted-foreground mb-2'>Quick Connect</p>
            <div className='bg-white/5 border border-white/10 rounded-lg px-3 py-2 font-mono text-xs text-muted-foreground leading-relaxed'>
              <span className='text-purple-400'>import</span> {'{ createClient }'}{' '}
              <span className='text-purple-400'>from</span>{' '}
              <span className='text-green-400'>'@supabase/supabase-js'</span>
              <br />
              <br />
              <span className='text-purple-400'>const</span> supabase ={' '}
              <span className='text-blue-400'>createClient</span>(
              <br />
              {'  '}
              <span className='text-green-400'>'{creds?.project_url || 'YOUR_URL'}'</span>,
              <br />
              {'  '}
              <span className='text-green-400'>
                '{creds?.anon_key ? creds.anon_key.substring(0, 20) + '...' : 'YOUR_ANON_KEY'}'
              </span>
              <br />)
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className='px-6 py-3 border-t border-white/10 flex justify-end'>
          <button
            onClick={onClose}
            className='px-4 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/10 transition-colors'
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
