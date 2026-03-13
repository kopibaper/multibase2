import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LayoutDashboard, FolderKanban, LogOut, User, ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

export default function WorkspaceLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/');
  };

  return (
    <div className='min-h-screen bg-background text-foreground relative'>
      {/* Background Gradients */}
      <div className='fixed inset-0 z-0 pointer-events-none overflow-hidden'>
        <div className='absolute top-0 left-1/4 w-[600px] h-[600px] bg-brand-500/8 rounded-full blur-[120px] -translate-y-1/2' />
        <div className='absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-brand-900/10 rounded-full blur-[100px] translate-y-1/2' />
        <div className='absolute top-1/2 right-0 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px] translate-x-1/2' />
      </div>

      {/* Header */}
      <header className='sticky top-0 z-50 border-b border-white/5 backdrop-blur-md bg-background/80'>
        <div className='w-full px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between'>
          {/* Left: Logo + Nav */}
          <div className='flex items-center gap-8'>
            <div
              className='flex items-center gap-2 font-bold text-xl tracking-tight cursor-pointer'
              onClick={() => navigate('/')}
            >
              <img src='/logo.png' alt='Multibase' className='w-8 h-8' />
              Multibase
            </div>

            <nav className='hidden sm:flex items-center gap-1'>
              <button
                onClick={() => navigate('/workspace')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname.startsWith('/workspace')
                    ? 'bg-brand-500/15 text-brand-400'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                }`}
              >
                <FolderKanban className='w-4 h-4' />
                Workspace
              </button>
              <button
                onClick={() => navigate('/dashboard')}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  location.pathname.startsWith('/dashboard')
                    ? 'bg-red-500/15 text-red-400'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                }`}
              >
                <LayoutDashboard className='w-4 h-4' />
                <span className={location.pathname.startsWith('/dashboard') ? 'text-red-400' : ''}>Dashboard</span>
              </button>
            </nav>
          </div>

          {/* Right: User Menu */}
          <div className='flex items-center gap-3'>
            <div className='relative' ref={menuRef}>
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className='flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors'
            >
              <div className='w-7 h-7 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400 text-xs font-bold'>
                {user?.username?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className='hidden sm:inline'>{user?.username || user?.email}</span>
              <ChevronDown className='w-4 h-4' />
            </button>

            {userMenuOpen && (
              <div className='absolute right-0 mt-2 w-48 rounded-xl border border-white/10 bg-card/95 backdrop-blur-xl shadow-2xl py-1 z-50'>
                <button
                  onClick={() => {
                    navigate('/profile');
                    setUserMenuOpen(false);
                  }}
                  className='flex items-center gap-2 w-full px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors'
                >
                  <User className='w-4 h-4' />
                  Profile
                </button>
                <div className='border-t border-white/5 my-1' />
                <button
                  onClick={handleLogout}
                  className='flex items-center gap-2 w-full px-4 py-2.5 text-sm text-red-400 hover:text-red-300 hover:bg-white/5 transition-colors'
                >
                  <LogOut className='w-4 h-4' />
                  Sign Out
                </button>
              </div>
            )}
          </div>
          </div>
        </div>
      </header>

      {/* Content – extra bottom padding on mobile for bottom nav */}
      <main className='relative z-10 pb-16 sm:pb-0'>
        <Outlet />
      </main>

      {/* Mobile Bottom Navigation (only visible on sm-) */}
      <nav className='sm:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-white/10 bg-background/95 backdrop-blur-md flex'>
        <button
          onClick={() => navigate('/workspace')}
          className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
            location.pathname.startsWith('/workspace')
              ? 'text-brand-400'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <FolderKanban className='w-5 h-5' />
          Workspace
        </button>
        <button
          onClick={() => navigate('/dashboard')}
          className={`flex-1 flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors ${
            location.pathname.startsWith('/dashboard')
              ? 'text-red-400'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <LayoutDashboard className='w-5 h-5' />
          Dashboard
        </button>
      </nav>
    </div>
  );
}
