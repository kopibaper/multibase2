import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { vaultApi } from '../../lib/api';
import {
  KeyRound,
  Plus,
  Eye,
  EyeOff,
  Pencil,
  Trash2,
  Loader2,
  ShieldCheck,
  X,
  Bot,
  Zap,
} from 'lucide-react';

const AI_PRESETS = [
  { name: 'OPENAI_API_KEY',     description: 'OpenAI API key for Edge Functions and AI features',  icon: Bot },
  { name: 'ANTHROPIC_API_KEY',  description: 'Anthropic Claude API key',                           icon: Bot },
  { name: 'HUGGINGFACE_TOKEN',  description: 'Hugging Face Inference API token',                   icon: Zap },
];
import { toast } from 'sonner';

interface VaultPanelProps {
  instanceName: string;
}

interface Secret {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

interface AddModalState {
  secretName: string;
  value: string;
  description: string;
}

export default function VaultPanel({ instanceName }: VaultPanelProps) {
  const queryClient = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState<AddModalState>({ secretName: '', value: '', description: '' });
  const [revealedId, setRevealedId] = useState<string | null>(null);
  const [revealedValue, setRevealedValue] = useState<string | null>(null);
  const [editSecret, setEditSecret] = useState<Secret | null>(null);
  const [editValue, setEditValue] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Secret | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['vault-secrets', instanceName],
    queryFn: () => vaultApi.list(instanceName),
  });

  const secrets: Secret[] = data?.secrets ?? [];

  const addMutation = useMutation({
    mutationFn: () => vaultApi.add(instanceName, addForm.secretName, addForm.value, addForm.description),
    onSuccess: () => {
      toast.success('Secret created');
      queryClient.invalidateQueries({ queryKey: ['vault-secrets', instanceName] });
      setAddOpen(false);
      setAddForm({ secretName: '', value: '', description: '' });
    },
    onError: (err: any) => toast.error('Failed to create secret', { description: err.message }),
  });

  const updateMutation = useMutation({
    mutationFn: () => vaultApi.update(instanceName, editSecret!.id, editValue),
    onSuccess: () => {
      toast.success('Secret updated');
      queryClient.invalidateQueries({ queryKey: ['vault-secrets', instanceName] });
      setEditSecret(null);
      setEditValue('');
    },
    onError: (err: any) => toast.error('Failed to update secret', { description: err.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: () => vaultApi.remove(instanceName, deleteTarget!.id),
    onSuccess: () => {
      toast.success('Secret deleted');
      queryClient.invalidateQueries({ queryKey: ['vault-secrets', instanceName] });
      setDeleteTarget(null);
    },
    onError: (err: any) => toast.error('Failed to delete secret', { description: err.message }),
  });

  const [revealing, setRevealing] = useState<string | null>(null);
  const handleReveal = async (secret: Secret) => {
    if (revealedId === secret.id) {
      setRevealedId(null);
      setRevealedValue(null);
      return;
    }
    setRevealing(secret.id);
    try {
      const { value } = await vaultApi.reveal(instanceName, secret.id);
      setRevealedId(secret.id);
      setRevealedValue(value);
    } catch (err: any) {
      toast.error('Could not reveal secret', { description: err.message });
    } finally {
      setRevealing(null);
    }
  };

  return (
    <div className='space-y-6'>
      {/* Header */}
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-lg font-semibold flex items-center gap-2'>
            <KeyRound className='w-5 h-5 text-brand-400' />
            Vault Secrets
          </h2>
          <p className='text-sm text-muted-foreground mt-0.5'>
            Encrypted key-value secrets via pgsodium (AES-256-GCM). Values are never logged.
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className='flex items-center gap-2 px-3 py-2 bg-primary text-primary-foreground text-sm rounded-lg hover:bg-primary/90 transition-colors'
        >
          <Plus className='w-4 h-4' />
          Add Secret
        </button>
      </div>

      {/* Info banner */}
      <div className='flex items-start gap-2 text-xs text-muted-foreground bg-green-500/10 border border-green-500/20 rounded-lg p-3'>
        <ShieldCheck className='w-4 h-4 text-green-400 flex-shrink-0 mt-0.5' />
        <p>
          Secrets are stored encrypted in <code className='font-mono'>vault.secrets</code> using
          pgsodium. Only the secret name is shown in the list — reveal the value on demand.
        </p>
      </div>

      {/* AI Quick-Add */}
      <div>
        <p className='text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 mb-2'>Quick Add AI Keys</p>
        <div className='flex flex-wrap gap-2'>
          {AI_PRESETS.map(({ name, description, icon: Icon }) => {
            const exists = secrets.some((s) => s.name === name);
            return (
              <button
                key={name}
                disabled={exists}
                onClick={() => {
                  setAddForm({ secretName: name, value: '', description });
                  setAddOpen(true);
                }}
                className='flex items-center gap-2 px-3 py-1.5 rounded-lg border border-white/10 text-sm text-muted-foreground hover:text-foreground hover:border-white/20 hover:bg-white/5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
              >
                <Icon className='w-3.5 h-3.5' />
                {name}
                {exists && <span className='text-xs text-green-400'>✓</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className='glass-card overflow-hidden'>
        {isLoading ? (
          <div className='flex justify-center p-8'>
            <Loader2 className='w-6 h-6 animate-spin text-muted-foreground' />
          </div>
        ) : secrets.length === 0 ? (
          <div className='text-center p-10 text-muted-foreground'>
            <KeyRound className='w-10 h-10 mx-auto opacity-20 mb-3' />
            <p className='font-medium'>No secrets yet</p>
            <p className='text-xs'>Add your first secret to get started.</p>
          </div>
        ) : (
          <table className='w-full text-sm'>
            <thead>
              <tr className='border-b border-border text-left text-xs text-muted-foreground'>
                <th className='px-4 py-3 font-medium'>Name</th>
                <th className='px-4 py-3 font-medium hidden sm:table-cell'>Description</th>
                <th className='px-4 py-3 font-medium hidden md:table-cell'>Updated</th>
                <th className='px-4 py-3 font-medium w-32 text-right'>Actions</th>
              </tr>
            </thead>
            <tbody>
              {secrets.map((secret) => (
                <tr key={secret.id} className='border-b border-border/50 hover:bg-white/3 transition-colors'>
                  <td className='px-4 py-3 font-mono font-medium text-foreground'>
                    {secret.name}
                    {revealedId === secret.id && revealedValue !== null && (
                      <div className='mt-1 text-xs font-mono text-yellow-400 bg-yellow-400/10 rounded px-2 py-1 break-all'>
                        {revealedValue}
                      </div>
                    )}
                  </td>
                  <td className='px-4 py-3 text-muted-foreground hidden sm:table-cell'>
                    {secret.description || <span className='opacity-30'>—</span>}
                  </td>
                  <td className='px-4 py-3 text-muted-foreground text-xs hidden md:table-cell'>
                    {new Date(secret.updated_at).toLocaleDateString()}
                  </td>
                  <td className='px-4 py-3'>
                    <div className='flex items-center justify-end gap-1'>
                      <button
                        onClick={() => handleReveal(secret)}
                        disabled={revealing === secret.id}
                        className='p-1.5 hover:bg-white/10 rounded text-muted-foreground hover:text-foreground transition-colors'
                        title={revealedId === secret.id ? 'Hide' : 'Reveal value'}
                      >
                        {revealing === secret.id ? (
                          <Loader2 className='w-3.5 h-3.5 animate-spin' />
                        ) : revealedId === secret.id ? (
                          <EyeOff className='w-3.5 h-3.5' />
                        ) : (
                          <Eye className='w-3.5 h-3.5' />
                        )}
                      </button>
                      <button
                        onClick={() => { setEditSecret(secret); setEditValue(''); }}
                        className='p-1.5 hover:bg-white/10 rounded text-muted-foreground hover:text-foreground transition-colors'
                        title='Edit value'
                      >
                        <Pencil className='w-3.5 h-3.5' />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(secret)}
                        className='p-1.5 hover:bg-destructive/20 rounded text-muted-foreground hover:text-destructive transition-colors'
                        title='Delete'
                      >
                        <Trash2 className='w-3.5 h-3.5' />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Add Modal ── */}
      {addOpen && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60'>
          <div className='bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-xl'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='font-semibold'>Add Secret</h3>
              <button onClick={() => setAddOpen(false)} className='text-muted-foreground hover:text-foreground'>
                <X className='w-4 h-4' />
              </button>
            </div>
            <div className='space-y-3'>
              <div>
                <label className='text-xs text-muted-foreground'>Name *</label>
                <input
                  className='mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary font-mono'
                  placeholder='e.g. STRIPE_SECRET_KEY'
                  value={addForm.secretName}
                  onChange={(e) => setAddForm((f) => ({ ...f, secretName: e.target.value }))}
                />
              </div>
              <div>
                <label className='text-xs text-muted-foreground'>Value *</label>
                <input
                  type='password'
                  className='mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary font-mono'
                  placeholder='Secret value'
                  value={addForm.value}
                  onChange={(e) => setAddForm((f) => ({ ...f, value: e.target.value }))}
                />
              </div>
              <div>
                <label className='text-xs text-muted-foreground'>Description</label>
                <input
                  className='mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary'
                  placeholder='Optional description'
                  value={addForm.description}
                  onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
            </div>
            <div className='flex justify-end gap-2 mt-5'>
              <button
                onClick={() => setAddOpen(false)}
                className='px-4 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 transition-colors'
              >
                Cancel
              </button>
              <button
                onClick={() => addMutation.mutate()}
                disabled={addMutation.isPending || !addForm.secretName || !addForm.value}
                className='flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50'
              >
                {addMutation.isPending && <Loader2 className='w-3.5 h-3.5 animate-spin' />}
                Create Secret
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Modal ── */}
      {editSecret && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60'>
          <div className='bg-card border border-border rounded-xl p-6 w-full max-w-md shadow-xl'>
            <div className='flex items-center justify-between mb-4'>
              <h3 className='font-semibold'>Update Secret — <span className='font-mono text-brand-400'>{editSecret.name}</span></h3>
              <button onClick={() => setEditSecret(null)} className='text-muted-foreground hover:text-foreground'>
                <X className='w-4 h-4' />
              </button>
            </div>
            <div>
              <label className='text-xs text-muted-foreground'>New Value *</label>
              <input
                type='password'
                className='mt-1 w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary font-mono'
                placeholder='New secret value'
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
              />
            </div>
            <div className='flex justify-end gap-2 mt-5'>
              <button
                onClick={() => setEditSecret(null)}
                className='px-4 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 transition-colors'
              >
                Cancel
              </button>
              <button
                onClick={() => updateMutation.mutate()}
                disabled={updateMutation.isPending || !editValue}
                className='flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50'
              >
                {updateMutation.isPending && <Loader2 className='w-3.5 h-3.5 animate-spin' />}
                Update
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirm ── */}
      {deleteTarget && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/60'>
          <div className='bg-card border border-border rounded-xl p-6 w-full max-w-sm shadow-xl'>
            <h3 className='font-semibold mb-2'>Delete Secret</h3>
            <p className='text-sm text-muted-foreground mb-4'>
              Are you sure you want to delete <span className='font-mono text-foreground'>{deleteTarget.name}</span>?
              This cannot be undone.
            </p>
            <div className='flex justify-end gap-2'>
              <button
                onClick={() => setDeleteTarget(null)}
                className='px-4 py-2 text-sm rounded-lg bg-white/5 hover:bg-white/10 transition-colors'
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className='flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-destructive text-white hover:bg-destructive/90 transition-colors disabled:opacity-50'
              >
                {deleteMutation.isPending && <Loader2 className='w-3.5 h-3.5 animate-spin' />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
