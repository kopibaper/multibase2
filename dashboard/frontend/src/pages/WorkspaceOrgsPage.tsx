import { useNavigate } from 'react-router-dom';
import { useOrg, type Organisation } from '../contexts/OrgContext';
import { useAuth } from '../contexts/AuthContext';
import {
  Building2,
  Users,
  FolderKanban,
  ChevronRight,
  Plus,
  Crown,
  Shield,
  Eye,
  Loader2,
} from 'lucide-react';

function roleStyle(role: string): string {
  switch (role) {
    case 'owner':
      return 'text-yellow-400 bg-yellow-500/10';
    case 'admin':
      return 'text-blue-400 bg-blue-500/10';
    default:
      return 'text-muted-foreground bg-white/5';
  }
}

function RoleIcon({ role }: { role: string }) {
  if (role === 'owner') return <Crown className='w-3 h-3' />;
  if (role === 'admin') return <Shield className='w-3 h-3' />;
  return <Eye className='w-3 h-3' />;
}

export default function WorkspaceOrgsPage() {
  const { orgs, loading, setActiveOrg } = useOrg();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const handleSelect = (org: Organisation) => {
    setActiveOrg(org);
    navigate('/workspace/projects');
  };

  if (loading) {
    return (
      <div className='flex items-center justify-center h-[calc(100vh-4rem)]'>
        <Loader2 className='w-8 h-8 animate-spin text-brand-500' />
      </div>
    );
  }

  return (
    <div className='min-h-[calc(100vh-4rem)]'>
      <div className='max-w-4xl mx-auto px-4 sm:px-6 py-12'>
        {/* Page Header */}
        <div className='mb-10'>
          <h1 className='text-3xl font-bold text-foreground'>Organisations</h1>
          <p className='text-muted-foreground mt-1.5'>
            Select an organisation to view and manage its projects
          </p>
        </div>

        {orgs.length === 0 ? (
          <div className='text-center py-20'>
            <div className='w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-4'>
              <Building2 className='w-8 h-8 text-muted-foreground/40' />
            </div>
            <h3 className='text-lg font-semibold mb-2'>No organisations yet</h3>
            <p className='text-sm text-muted-foreground mb-6'>
              Create your first organisation to get started
            </p>
            {isAdmin && (
            <button
              onClick={() => navigate('/orgs/new')}
              className='inline-flex items-center gap-2 px-5 py-2.5 bg-brand-500 text-white rounded-xl text-sm font-medium hover:bg-brand-600 transition-colors'
            >
              <Plus className='w-4 h-4' />
              New Organisation
            </button>
            )}
          </div>
        ) : (
          <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
            {orgs.map((org) => (
              <button
                key={org.id}
                onClick={() => handleSelect(org)}
                className='text-left p-5 rounded-2xl border border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-brand-500/30 transition-all group flex flex-col gap-4'
              >
                {/* Header */}
                <div className='flex items-start justify-between'>
                  <div className='flex items-center gap-3'>
                    <div className='w-10 h-10 rounded-xl bg-brand-500/15 flex items-center justify-center flex-shrink-0'>
                      <Building2 className='w-5 h-5 text-brand-400' />
                    </div>
                    <div className='min-w-0'>
                      <p className='font-semibold text-foreground'>{org.name}</p>
                      <p className='text-xs text-muted-foreground'>@{org.slug}</p>
                    </div>
                  </div>
                  <ChevronRight className='w-5 h-5 text-muted-foreground/30 group-hover:text-brand-400 transition-colors mt-0.5 flex-shrink-0' />
                </div>

                {/* Description */}
                {org.description && (
                  <p className='text-sm text-muted-foreground line-clamp-2'>{org.description}</p>
                )}

                {/* Meta */}
                <div className='flex items-center gap-3 flex-wrap'>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${roleStyle(org.role)}`}
                  >
                    <RoleIcon role={org.role} />
                    {org.role}
                  </span>
                  {org.memberCount !== undefined && (
                    <span className='flex items-center gap-1 text-xs text-muted-foreground'>
                      <Users className='w-3 h-3' />
                      {org.memberCount} {org.memberCount === 1 ? 'member' : 'members'}
                    </span>
                  )}
                  {org.instanceCount !== undefined && (
                    <span className='flex items-center gap-1 text-xs text-muted-foreground'>
                      <FolderKanban className='w-3 h-3' />
                      {org.instanceCount} {org.instanceCount === 1 ? 'project' : 'projects'}
                    </span>
                  )}
                </div>
              </button>
            ))}

            {/* New Organisation card */}
            {isAdmin && (
            <button
              onClick={() => navigate('/orgs/new')}
              className='p-5 rounded-2xl border border-dashed border-white/10 hover:border-brand-500/30 hover:bg-white/[0.02] transition-all group flex items-center justify-center gap-3 min-h-[140px]'
            >
              <div className='w-8 h-8 rounded-lg border border-dashed border-white/20 group-hover:border-brand-500/40 flex items-center justify-center transition-colors'>
                <Plus className='w-4 h-4 text-muted-foreground group-hover:text-brand-400 transition-colors' />
              </div>
              <span className='text-sm text-muted-foreground group-hover:text-foreground transition-colors'>
                New Organisation
              </span>
            </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
