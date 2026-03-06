import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ChevronDown, Plus, Settings, Users, Check } from 'lucide-react';
import { useOrg } from '../contexts/OrgContext';

export default function OrgSwitcher() {
  const { orgs, activeOrg, setActiveOrg } = useOrg();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (!activeOrg) {
    return (
      <button
        onClick={() => navigate('/orgs/new')}
        className='flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-dashed border-white/20 text-muted-foreground hover:text-foreground hover:bg-white/5'
      >
        <Building2 className='w-4 h-4' />
        Create Organisation
      </button>
    );
  }

  return (
    <div className='relative' ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className='flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors bg-white/5 hover:bg-white/10 border border-white/10'
      >
        <Building2 className='w-4 h-4 text-brand-400' />
        <span className='max-w-[120px] truncate'>{activeOrg.name}</span>
        <ChevronDown className={`w-3 h-3 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className='absolute top-full mt-2 left-0 w-64 bg-background border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden'>
          {/* Org list */}
          <div className='p-2'>
            <p className='text-xs text-muted-foreground px-2 py-1 mb-1'>Your Organisations</p>
            {orgs.map((org) => (
              <button
                key={org.id}
                onClick={() => { setActiveOrg(org); setOpen(false); }}
                className='w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm hover:bg-white/5 transition-colors'
              >
                <div className='w-7 h-7 rounded-md bg-brand-500/20 flex items-center justify-center text-brand-400 font-bold text-xs flex-shrink-0'>
                  {org.name.charAt(0).toUpperCase()}
                </div>
                <div className='flex-1 text-left overflow-hidden'>
                  <p className='font-medium truncate'>{org.name}</p>
                  <p className='text-xs text-muted-foreground capitalize'>{org.role}</p>
                </div>
                {org.id === activeOrg.id && <Check className='w-4 h-4 text-brand-400 flex-shrink-0' />}
              </button>
            ))}
          </div>

          <div className='border-t border-white/5 p-2'>
            {/* Settings + Members for active org */}
            {(activeOrg.role === 'owner' || activeOrg.role === 'admin') && (
              <>
                <button
                  onClick={() => { navigate(`/orgs/${activeOrg.slug}/members`); setOpen(false); }}
                  className='w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors'
                >
                  <Users className='w-4 h-4' />
                  Members
                </button>
                <button
                  onClick={() => { navigate(`/orgs/${activeOrg.slug}/settings`); setOpen(false); }}
                  className='w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors'
                >
                  <Settings className='w-4 h-4' />
                  Settings
                </button>
              </>
            )}
            <button
              onClick={() => { navigate('/orgs/new'); setOpen(false); }}
              className='w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors'
            >
              <Plus className='w-4 h-4' />
              Create Organisation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
