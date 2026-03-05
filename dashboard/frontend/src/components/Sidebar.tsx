import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useOrg } from '../contexts/OrgContext';
import { cn } from '../lib/utils';
import {
  LayoutDashboard,
  Bell,
  Database,
  Users,
  Key,
  FileText,
  Activity,
  Settings,
  LogOut,
  ChevronDown,
  Shield,
  Mail,
  BookOpen,
  HardDrive,
  Cloud,
  Building2,
  Plus,
  UserCircle2,
  SlidersHorizontal,
} from 'lucide-react';
import { useState, createContext, useContext } from 'react';

// Context for onNavigate callback (for mobile menu close)
const SidebarContext = createContext<{ onNavigate?: () => void }>({});

interface SidebarLinkProps {
  to: string;
  icon: React.ElementType;
  children: React.ReactNode;
  end?: boolean;
}

const SidebarLink = ({ to, icon: Icon, children, end }: SidebarLinkProps) => {
  const { onNavigate } = useContext(SidebarContext);

  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
          isActive
            ? 'bg-brand-500/15 text-brand-400 shadow-[inset_0_0_0_1px_rgba(62,207,142,0.3)]'
            : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
        )
      }
    >
      <Icon className='w-4 h-4 flex-shrink-0' />
      <span>{children}</span>
    </NavLink>
  );
};

const SidebarGroup = ({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className='mb-2'>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className='flex items-center justify-between w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 hover:text-muted-foreground transition-colors'
      >
        {title}
        <ChevronDown className={cn('w-3 h-3 transition-transform', isOpen ? '' : '-rotate-90')} />
      </button>
      {isOpen && <div className='space-y-0.5 mt-1'>{children}</div>}
    </div>
  );
};

interface SidebarProps {
  onNavigate?: () => void;
}

export default function Sidebar({ onNavigate }: SidebarProps) {
  const { user, logout } = useAuth();
  const { orgs, activeOrg, setActiveOrg } = useOrg();
  const navigate = useNavigate();
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <SidebarContext.Provider value={{ onNavigate }}>
      <aside className='glass-panel w-64 h-screen flex flex-col'>
        {/* Logo */}
        <div className='p-4 border-b border-white/5'>
          <NavLink to='/' onClick={onNavigate} className='flex items-center gap-3 hover:opacity-80 transition-opacity'>
            <img src='/logo.png' alt='Multibase' className='w-8 h-8' />
            <span className='text-lg font-bold text-foreground'>Multibase</span>
          </NavLink>
        </div>

        {/* Navigation */}
        <nav className='flex-1 overflow-y-auto py-4 px-3 space-y-1'>

          {/* Organisation Switcher */}
          <div className='mb-3'>
            <p className='px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60'>
              Organisation
            </p>
            {activeOrg ? (
              <div className='mt-1 space-y-0.5'>
                {/* Org switcher button */}
                <div className='relative'>
                  <button
                    onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
                    className='w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-white/5 transition-colors'
                  >
                    <div className='w-6 h-6 rounded-md bg-brand-500/20 flex items-center justify-center text-brand-400 font-bold text-xs flex-shrink-0'>
                      {activeOrg.name.charAt(0).toUpperCase()}
                    </div>
                    <span className='flex-1 text-left truncate'>{activeOrg.name}</span>
                    <ChevronDown className={cn('w-3 h-3 text-muted-foreground transition-transform', orgDropdownOpen ? 'rotate-180' : '')} />
                  </button>
                  {orgDropdownOpen && orgs.length > 1 && (
                    <div className='mx-2 mb-1 rounded-lg border border-white/10 bg-background/90 overflow-hidden'>
                      {orgs.filter(o => o.id !== activeOrg.id).map(org => (
                        <button
                          key={org.id}
                          onClick={() => { setActiveOrg(org); setOrgDropdownOpen(false); onNavigate?.(); }}
                          className='w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors'
                        >
                          <div className='w-5 h-5 rounded bg-white/10 flex items-center justify-center text-xs font-bold flex-shrink-0'>
                            {org.name.charAt(0).toUpperCase()}
                          </div>
                          <span className='truncate'>{org.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {/* Members + Settings links */}
                {(activeOrg.role === 'owner' || activeOrg.role === 'admin') && (
                  <NavLink
                    to={`/orgs/${activeOrg.slug}/members`}
                    onClick={onNavigate}
                    className={({ isActive }) => cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      isActive ? 'bg-brand-500/15 text-brand-400' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                    )}
                  >
                    <UserCircle2 className='w-4 h-4 flex-shrink-0' />
                    Members
                  </NavLink>
                )}
                {(activeOrg.role === 'owner' || activeOrg.role === 'admin') && (
                  <NavLink
                    to={`/orgs/${activeOrg.slug}/settings`}
                    onClick={onNavigate}
                    className={({ isActive }) => cn(
                      'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                      isActive ? 'bg-brand-500/15 text-brand-400' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                    )}
                  >
                    <SlidersHorizontal className='w-4 h-4 flex-shrink-0' />
                    Org Settings
                  </NavLink>
                )}
                <NavLink
                  to='/orgs/new'
                  onClick={onNavigate}
                  className={({ isActive }) => cn(
                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                    isActive ? 'bg-brand-500/15 text-brand-400' : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                  )}
                >
                  <Plus className='w-4 h-4 flex-shrink-0' />
                  New Organisation
                </NavLink>
              </div>
            ) : (
              <button
                onClick={() => { navigate('/orgs/new'); onNavigate?.(); }}
                className='mt-1 w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors border border-dashed border-white/10'
              >
                <Building2 className='w-4 h-4 flex-shrink-0' />
                Create Organisation
              </button>
            )}
          </div>

          <SidebarGroup title='Overview'>
            <SidebarLink to='/dashboard' icon={LayoutDashboard} end>
              Dashboard
            </SidebarLink>
            <SidebarLink to='/shared' icon={Cloud}>
              Shared Infra
            </SidebarLink>
            <SidebarLink to='/templates' icon={Database}>
              Templates
            </SidebarLink>
          </SidebarGroup>

          <SidebarGroup title='Monitoring'>
            <SidebarLink to='/alerts' icon={Bell}>
              Alerts
            </SidebarLink>
            <SidebarLink to='/alert-rules' icon={Shield}>
              Alert Rules
            </SidebarLink>
            <SidebarLink to='/backups' icon={HardDrive}>
              Backups
            </SidebarLink>
          </SidebarGroup>

          <SidebarGroup title='Developer'>
            <SidebarLink to='/api-keys' icon={Key}>
              API Keys
            </SidebarLink>
            <SidebarLink to='/api-docs' icon={FileText}>
              API Docs
            </SidebarLink>
          </SidebarGroup>

          {user?.role === 'admin' && (
            <SidebarGroup title='Admin'>
              <SidebarLink to='/users' icon={Users}>
                Users
              </SidebarLink>
              <SidebarLink to='/activity' icon={Activity}>
                Activity Log
              </SidebarLink>
              <SidebarLink to='/migrations' icon={Database}>
                Migrations
              </SidebarLink>
              <SidebarLink to='/settings/smtp' icon={Mail}>
                SMTP Settings
              </SidebarLink>
            </SidebarGroup>
          )}

          <SidebarGroup title='Resources'>
            <SidebarLink to='/setup' icon={BookOpen}>
              Setup Guide
            </SidebarLink>
          </SidebarGroup>
        </nav>

        {/* User Section */}
        <div className='p-3 border-t border-white/5'>
          <NavLink
            to='/profile'
            onClick={onNavigate}
            className='flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors mb-2'
          >
            <div className='w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center text-white font-semibold text-sm'>
              {user?.username?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div className='flex-1 min-w-0'>
              <p className='text-sm font-medium text-foreground truncate'>{user?.username}</p>
              {user?.role === 'admin' ? (
                <p className='text-xs font-medium text-brand-400 truncate'>Global Admin</p>
              ) : (
                <p className='text-xs text-muted-foreground truncate'>{user?.email}</p>
              )}
            </div>
            <Settings className='w-4 h-4 text-muted-foreground' />
          </NavLink>
          <button
            onClick={handleLogout}
            className='flex items-center gap-3 w-full px-3 py-2 text-sm text-destructive hover:bg-destructive/10 rounded-lg transition-colors'
          >
            <LogOut className='w-4 h-4' />
            Logout
          </button>
        </div>
      </aside>
    </SidebarContext.Provider>
  );
}
