import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

// Generic Button component (same as in LandingPage)
const SupabaseButton = ({ className, variant = 'primary', children, ...props }: any) => {
  const baseStyles =
    'inline-flex items-center justify-center rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background';
  const variants = {
    primary:
      'bg-brand-500 text-white hover:bg-brand-600 shadow-[0_0_10px_rgba(62,207,142,0.5)] hover:shadow-[0_0_20px_rgba(62,207,142,0.6)]',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    outline: 'border border-input hover:bg-accent hover:text-accent-foreground',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
  };

  // @ts-ignore
  const variantClasses = variants[variant] || variants.primary;

  return (
    <button className={`${baseStyles} ${variantClasses} h-10 py-2 px-4 ${className}`} {...props}>
      {children}
    </button>
  );
};

export default function Navbar() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <nav className='z-50 border-b border-white/5 backdrop-blur-md fixed top-0 bg-background/80 w-full'>
      <div className='container mx-auto px-6 h-16 flex items-center justify-between'>
        <div
          className='flex items-center gap-2 font-bold text-xl tracking-tight cursor-pointer'
          onClick={() => navigate('/')}
        >
          <img src='/logo.png' alt='Multibase' className='w-8 h-8' />
          Multibase
        </div>
        <div className='flex items-center gap-4'>
          <a
            href='https://supabase.com/docs'
            target='_blank'
            rel='noopener noreferrer'
            className='text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block'
          >
            Documentation
          </a>
          <a
            href='/setup'
            className='text-sm text-muted-foreground hover:text-foreground transition-colors hidden sm:block'
          >
            Setup Guide
          </a>
          {user ? (
            <SupabaseButton onClick={() => navigate('/dashboard')}>Dashboard</SupabaseButton>
          ) : (
            <>
              <SupabaseButton variant='ghost' onClick={() => navigate('/login')} className='hidden sm:inline-flex'>
                Sign In
              </SupabaseButton>
              <SupabaseButton onClick={() => navigate('/login')}>Get Started</SupabaseButton>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
