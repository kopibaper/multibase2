import { useState, useEffect } from 'react';
import { Users, UserPlus, Trash2, Shield, Crown, Eye, User } from 'lucide-react';
import { useOrg } from '../contexts/OrgContext';
import { useAuth } from '../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

type Role = 'owner' | 'admin' | 'member' | 'viewer';

interface Member {
  id: string;
  userId: string;
  role: Role;
  joinedAt: string;
  user: { id: string; email: string; username: string; };
}

const RoleIcon = ({ role }: { role: Role }) => {
  if (role === 'owner') return <Crown className='w-3 h-3 text-yellow-400' />;
  if (role === 'admin') return <Shield className='w-3 h-3 text-blue-400' />;
  if (role === 'viewer') return <Eye className='w-3 h-3 text-muted-foreground' />;
  return <User className='w-3 h-3 text-muted-foreground' />;
};

const roleOrder: Role[] = ['owner', 'admin', 'member', 'viewer'];

export default function OrgMembers() {
  const { activeOrg } = useOrg();
  const { token, user } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('member');
  const [inviting, setInviting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const canManage = activeOrg?.role === 'owner' || activeOrg?.role === 'admin';

  const fetchMembers = async () => {
    if (!activeOrg || !token) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/orgs/${activeOrg.id}/members`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setMembers(await res.json());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchMembers(); }, [activeOrg?.id]);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !activeOrg) return;
    setInviting(true); setError(''); setSuccess('');
    try {
      const res = await fetch(`${API_URL}/api/orgs/${activeOrg.id}/members`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Failed'); }
      setSuccess(`${inviteEmail} added as ${inviteRole}`);
      setInviteEmail('');
      fetchMembers();
    } catch (e: any) { setError(e.message); }
    finally { setInviting(false); }
  };

  const handleRoleChange = async (memberId: string, newRole: Role) => {
    if (!activeOrg) return;
    try {
      await fetch(`${API_URL}/api/orgs/${activeOrg.id}/members/${memberId}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole }),
      });
      fetchMembers();
    } catch (e) { console.error(e); }
  };

  const handleRemove = async (memberId: string) => {
    if (!activeOrg) return;
    try {
      await fetch(`${API_URL}/api/orgs/${activeOrg.id}/members/${memberId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchMembers();
    } catch (e) { console.error(e); }
  };

  if (!activeOrg) return null;

  return (
    <div className='max-w-2xl mx-auto py-10 px-4 space-y-8'>
      <div className='flex items-center gap-3'>
        <div className='w-10 h-10 rounded-xl bg-brand-500/20 flex items-center justify-center'>
          <Users className='w-5 h-5 text-brand-400' />
        </div>
        <div>
          <h1 className='text-xl font-bold'>Members</h1>
          <p className='text-sm text-muted-foreground'>{activeOrg.name}</p>
        </div>
      </div>

      {/* Invite */}
      {canManage && (
        <div className='glass-panel p-6 rounded-xl border border-white/10 space-y-4'>
          <h2 className='font-semibold flex items-center gap-2'><UserPlus className='w-4 h-4' /> Add Member</h2>
          <div className='flex gap-2'>
            <input
              className='flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-brand-500'
              placeholder='Email address'
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleInvite()}
            />
            <select
              className='bg-input text-foreground border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary'
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value as Role)}
            >
              <option value='admin'>Admin</option>
              <option value='member'>Member</option>
              <option value='viewer'>Viewer</option>
            </select>
            <button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim()}
              className='px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-colors disabled:opacity-50'
            >
              {inviting ? 'Adding...' : 'Add'}
            </button>
          </div>
          {error && <p className='text-sm text-red-400'>{error}</p>}
          {success && <p className='text-sm text-brand-400'>{success}</p>}
        </div>
      )}

      {/* Member List */}
      <div className='glass-panel rounded-xl border border-white/10 overflow-hidden'>
        {loading ? (
          <div className='p-6 text-center text-muted-foreground text-sm'>Loading...</div>
        ) : members.length === 0 ? (
          <div className='p-6 text-center text-muted-foreground text-sm'>No members yet</div>
        ) : (
          <div className='divide-y divide-white/5'>
            {members.map(m => (
              <div key={m.id} className='flex items-center gap-3 px-4 py-3'>
                <div className='w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm font-bold flex-shrink-0'>
                  {m.user.username.charAt(0).toUpperCase()}
                </div>
                <div className='flex-1 overflow-hidden'>
                  <p className='text-sm font-medium truncate'>{m.user.username}</p>
                  <p className='text-xs text-muted-foreground truncate'>{m.user.email}</p>
                </div>
                <div className='flex items-center gap-2'>
                  {canManage && m.role !== 'owner' && m.user.id !== user?.id ? (
                    <select
                      className='bg-input text-foreground border border-border rounded-md px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-primary'
                      value={m.role}
                      onChange={e => handleRoleChange(m.id, e.target.value as Role)}
                    >
                      {roleOrder.filter(r => r !== 'owner').map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  ) : (
                    <span className='flex items-center gap-1 text-xs text-muted-foreground capitalize'>
                      <RoleIcon role={m.role} />{m.role}
                    </span>
                  )}
                  {canManage && m.role !== 'owner' && m.user.id !== user?.id && (
                    <button
                      onClick={() => handleRemove(m.id)}
                      className='p-1 rounded hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors'
                    >
                      <Trash2 className='w-3.5 h-3.5' />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
