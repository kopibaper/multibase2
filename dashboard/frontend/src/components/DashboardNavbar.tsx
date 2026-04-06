import { NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useOrg } from '../contexts/OrgContext';
import { cn } from '../lib/utils';
import {
  ChevronDown,
  LogOut,
  Settings,
  Plus,
  UserCircle2,
  SlidersHorizontal,
  Package,
  Server,
  Menu,
  X,
} from 'lucide-react';

interface DashboardNavbarProps {
  onMobileMenuToggle: () => void;
  mobileMenuOpen: boolean;
}

export default function DashboardNavbar({ onMobileMenuToggle, mobileMenuOpen }: DashboardNavbarProps) {
  const { user, logout } = useAuth();
  const { orgs, activeOrg, setActiveOrg } = useOrg();
  const navigate = useNavigate();
  const [orgOpen, setOrgOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className='fixed top-0 left-0 right-0 h-16 z-50 glass-panel flex items-center px-4 gap-2'>
      {/* Mobile hamburger */}
      <button
        onClick={onMobileMenuToggle}
        className='lg:hidden p-2 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-lg transition-colors mr-1'
      >
        {mobileMenuOpen ? <X className='w-5 h-5' /> : <Menu className='w-5 h-5' />}
      </button>

      {/* Logo */}
      <NavLink
        to='/dashboard'
        className='flex items-center gap-2.5 font-bold text-foreground hover:opacity-80 transition-opacity mr-4'
      >
        <img src='/logo.png' alt='Multibase' className='w-8 h-8' />
        <span className='text-lg hidden sm:block'>Multibase</span>
      </NavLink>

      {/* Nav links */}
      <NavLink
        to='/workspace/projects'
        className={({ isActive }) =>
          cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
            isActive
              ? 'bg-brand-500/15 text-brand-400 shadow-[inset_0_0_0_1px_rgba(62,207,142,0.3)]'
              : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
          )
        }
      >
        <Server className='w-4 h-4' />
        <span className='hidden sm:block'>Workspace</span>
      </NavLink>

      <NavLink
        to='/marketplace'
        className={({ isActive }) =>
          cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200',
            isActive
              ? 'bg-brand-500/15 text-brand-400 shadow-[inset_0_0_0_1px_rgba(62,207,142,0.3)]'
              : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
          )
        }
      >
        <Package className='w-4 h-4' />
        <span className='hidden sm:block'>Marketplace</span>
      </NavLink>

      {/* Spacer */}
      <div className='flex-1' />

      {/* Org Dropdown */}
      {activeOrg && (
        <div className='relative'>
          <button
            onClick={() => {
              setOrgOpen(!orgOpen);
              setProfileOpen(false);
            }}
            className='flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-white/5 transition-colors'
          >
            <div className='w-6 h-6 rounded-md bg-brand-500/20 flex items-center justify-center text-brand-400 font-bold text-xs flex-shrink-0'>
              {activeOrg.name.charAt(0).toUpperCase()}
            </div>
            <span className='hidden md:block max-w-[120px] truncate'>{activeOrg.name}</span>
            <ChevronDown
              className={cn(
                'w-3.5 h-3.5 text-muted-foreground transition-transform',
                orgOpen ? 'rotate-180' : ''
              )}
            />
          </button>

          {orgOpen && (
            <>
              <div className='fixed inset-0 z-10' onClick={() => setOrgOpen(false)} />
              <div className='absolute right-0 top-full mt-1 w-56 rounded-xl border border-white/10 bg-background/95 backdrop-blur-md shadow-xl z-20 py-1 overflow-hidden'>
                <p className='px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60'>
                  Organisation
                </p>
                {orgs.map((org) => (
                  <button
                    key={org.id}
                    onClick={() => {
                      setActiveOrg(org);
                      setOrgOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors',
                      org.id === activeOrg.id
                        ? 'text-brand-400 bg-brand-500/10'
                        : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                    )}
                  >
                    <div className='w-5 h-5 rounded bg-white/10 flex items-center justify-center text-xs font-bold flex-shrink-0'>
                      {org.name.charAt(0).toUpperCase()}
                    </div>
                    <span className='truncate'>{org.name}</span>
                  </button>
                ))}
                <div className='border-t border-white/5 mt-1 pt-1'>
                  {(activeOrg.role === 'owner' || activeOrg.role === 'admin') && (
                    <button
                      onClick={() => {
                        navigate(`/orgs/${activeOrg.slug}/members`);
                        setOrgOpen(false);
                      }}
                      className='w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors'
                    >
                      <UserCircle2 className='w-4 h-4' />
                      Members
                    </button>
                  )}
                  {(activeOrg.role === 'owner' || activeOrg.role === 'admin') && (
                    <button
                      onClick={() => {
                        navigate(`/orgs/${activeOrg.slug}/settings`);
                        setOrgOpen(false);
                      }}
                      className='w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors'
                    >
                      <SlidersHorizontal className='w-4 h-4' />
                      Org Settings
                    </button>
                  )}
                  <button
                    onClick={() => {
                      navigate('/orgs/new');
                      setOrgOpen(false);
                    }}
                    className='w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors'
                  >
                    <Plus className='w-4 h-4' />
                    New Organisation
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Profile Dropdown */}
      <div className='relative'>
        <button
          onClick={() => {
            setProfileOpen(!profileOpen);
            setOrgOpen(false);
          }}
          className='flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-colors'
        >
          <div className='w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0'>
            {user?.username?.charAt(0).toUpperCase() || 'U'}
          </div>
          <span className='text-sm font-medium text-foreground hidden md:block'>{user?.username}</span>
          <ChevronDown
            className={cn(
              'w-3.5 h-3.5 text-muted-foreground transition-transform hidden md:block',
              profileOpen ? 'rotate-180' : ''
            )}
          />
        </button>

        {profileOpen && (
          <>
            <div className='fixed inset-0 z-10' onClick={() => setProfileOpen(false)} />
            <div className='absolute right-0 top-full mt-1 w-52 rounded-xl border border-white/10 bg-background/95 backdrop-blur-md shadow-xl z-20 py-1 overflow-hidden'>
              <div className='px-3 py-2.5 border-b border-white/5'>
                <p className='text-sm font-medium text-foreground'>{user?.username}</p>
                {user?.role === 'admin' ? (
                  <p className='text-xs font-medium text-brand-400'>Global Admin</p>
                ) : (
                  <p className='text-xs text-muted-foreground truncate'>{user?.email}</p>
                )}
              </div>
              <button
                onClick={() => {
                  navigate('/profile');
                  setProfileOpen(false);
                }}
                className='w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors'
              >
                <Settings className='w-4 h-4' />
                Profile & Settings
              </button>
              <button
                onClick={handleLogout}
                className='w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-destructive/10 transition-colors'
              >
                <LogOut className='w-4 h-4' />
                Logout
              </button>
            </div>
          </>
        )}
      </div>
    </nav>
  );
}
