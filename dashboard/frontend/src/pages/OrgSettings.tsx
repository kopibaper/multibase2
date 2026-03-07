import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Building2, Save, Trash2, AlertTriangle, Plus } from 'lucide-react';
import { useOrg } from '../contexts/OrgContext';
import { useAuth } from '../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

export default function OrgSettings() {
  const { activeOrg, refreshOrgs, setActiveOrg, orgs } = useOrg();
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const isNew = location.pathname === '/orgs/new';

  const [name, setName] = useState(isNew ? '' : activeOrg?.name || '');
  const [description, setDescription] = useState(isNew ? '' : activeOrg?.description || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ── Create mode ─────────────────────────────────────────────────────────
  const handleCreate = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch(`${API_URL}/api/orgs`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create organisation');
      await refreshOrgs();
      setActiveOrg(data);
      navigate(`/orgs/${data.slug}/settings`);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  if (isNew) {
    return (
      <div className='max-w-2xl mx-auto py-10 px-4 space-y-8'>
        <div className='flex items-center gap-3'>
          <div className='w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center'>
            <Building2 className='w-5 h-5 text-brand-400' />
          </div>
          <div>
            <h1 className='text-xl font-bold'>New Organisation</h1>
            <p className='text-sm text-muted-foreground'>Create a new organisation to group your instances</p>
          </div>
        </div>

        <div className='glass-panel p-6 space-y-4 rounded-xl border border-white/10'>
          <div className='space-y-3'>
            <div>
              <label className='text-sm text-muted-foreground mb-1 block'>Organisation Name *</label>
              <input
                autoFocus
                className='w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500'
                placeholder='e.g. Mustermann GmbH'
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />
            </div>
            <div>
              <label className='text-sm text-muted-foreground mb-1 block'>Description (optional)</label>
              <textarea
                className='w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500 resize-none'
                rows={3}
                placeholder='Short description...'
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>
          </div>
          {error && <p className='text-sm text-red-400'>{error}</p>}
          <button
            onClick={handleCreate}
            disabled={saving || !name.trim()}
            className='flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors disabled:opacity-50'
          >
            <Plus className='w-4 h-4' />
            {saving ? 'Creating...' : 'Create Organisation'}
          </button>
        </div>
      </div>
    );
  }

  // ── Edit mode ────────────────────────────────────────────────────────────
  if (!activeOrg) return null;

  const canEdit = activeOrg.role === 'owner' || activeOrg.role === 'admin';
  // Server admins (user.role === 'admin') can always delete; org owners can always delete
  const canDelete = activeOrg.role === 'owner' || user?.role === 'admin';

  const handleSave = async () => {
    setSaving(true); setError(''); setSuccess('');
    try {
      const res = await fetch(`${API_URL}/api/orgs/${activeOrg.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      await refreshOrgs();
      setSuccess('Saved successfully');
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (confirmDelete !== activeOrg.name) return;
    setDeleting(true); setError('');
    try {
      const res = await fetch(`${API_URL}/api/orgs/${activeOrg.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      await refreshOrgs();
      const remaining = orgs.filter(o => o.id !== activeOrg.id);
      if (remaining.length > 0) setActiveOrg(remaining[0]);
      navigate('/dashboard');
    } catch (e: any) { setError(e.message); }
    finally { setDeleting(false); }
  };

  return (
    <div className='max-w-2xl mx-auto py-10 px-4 space-y-8'>
      <div className='flex items-center gap-3'>
        <div className='w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center'>
          <Building2 className='w-5 h-5 text-brand-400' />
        </div>
        <div>
          <h1 className='text-xl font-bold'>Organisation Settings</h1>
          <p className='text-sm text-muted-foreground'>{activeOrg.name}</p>
        </div>
      </div>

      {/* General */}
      <div className='glass-panel p-6 space-y-4 rounded-xl border border-white/10'>
        <h2 className='font-semibold'>General</h2>
        <div className='space-y-3'>
          <div>
            <label className='text-sm text-muted-foreground mb-1 block'>Organisation Name</label>
            <input
              className='w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500 disabled:opacity-50'
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={!canEdit}
            />
          </div>
          <div>
            <label className='text-sm text-muted-foreground mb-1 block'>Description (optional)</label>
            <textarea
              className='w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500 disabled:opacity-50 resize-none'
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              disabled={!canEdit}
            />
          </div>
        </div>
        {error && <p className='text-sm text-red-400'>{error}</p>}
        {success && <p className='text-sm text-brand-400'>{success}</p>}
        {canEdit && (
          <button
            onClick={handleSave}
            disabled={saving}
            className='flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors disabled:opacity-50'
          >
            <Save className='w-4 h-4' />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        )}
      </div>

      {/* Danger Zone */}
      {canDelete && (
        <div className='glass-panel p-6 space-y-4 rounded-xl border border-red-500/30'>
          <div className='flex items-center gap-2'>
            <AlertTriangle className='w-4 h-4 text-red-400' />
            <h2 className='font-semibold text-red-400'>Danger Zone</h2>
          </div>
          <p className='text-sm text-muted-foreground'>
            Deleting this organisation will remove all members and unassign all instances. This cannot be undone.
          </p>
          <div>
            <label className='text-sm text-muted-foreground mb-1 block'>
              Type <span className='text-foreground font-mono'>{activeOrg.name}</span> to confirm
            </label>
            <input
              className='w-full bg-white/5 border border-red-500/30 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500'
              placeholder={activeOrg.name}
              value={confirmDelete}
              onChange={e => setConfirmDelete(e.target.value)}
            />
          </div>
          <button
            onClick={handleDelete}
            disabled={deleting || confirmDelete !== activeOrg.name}
            className='flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
          >
            <Trash2 className='w-4 h-4' />
            {deleting ? 'Deleting...' : 'Delete Organisation'}
          </button>
        </div>
      )}
    </div>
  );
}
