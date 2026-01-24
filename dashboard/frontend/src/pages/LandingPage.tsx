import { useNavigate } from 'react-router-dom';
import { Database, Shield, Activity, Zap, Layers } from 'lucide-react';

// Generic Button component to avoid dependency issues if shadcn isn't fully set up or we want custom Supabase style
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

const FeatureCard = ({ icon: Icon, title, description }: { icon: any; title: string; description: string }) => (
  <div className='group p-6 rounded-xl border border-border bg-card/50 hover:bg-card transition-all hover:border-brand-500/50 hover:shadow-[0_0_30px_-10px_rgba(62,207,142,0.3)]'>
    <div className='mb-4 inline-flex items-center justify-center w-12 h-12 rounded-lg bg-brand-500/10 text-brand-500 group-hover:bg-brand-500 group-hover:text-white transition-colors'>
      <Icon className='w-6 h-6' />
    </div>
    <h3 className='text-xl font-semibold mb-2 text-foreground'>{title}</h3>
    <p className='text-muted-foreground'>{description}</p>
  </div>
);

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className='min-h-screen bg-background text-foreground flex flex-col overflow-hidden relative selection:bg-brand-500/30'>
      {/* Background Gradients */}
      <div className='fixed inset-0 z-0 pointer-events-none'>
        <div className='absolute top-0 left-1/4 w-[500px] h-[500px] bg-brand-500/10 rounded-full blur-[100px] -translate-y-1/2' />
        <div className='absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-brand-900/10 rounded-full blur-[100px] translate-y-1/2' />
      </div>

      {/* Navbar */}
      <nav className='relative z-10 border-b border-white/5 backdrop-blur-md sticky top-0'>
        <div className='container mx-auto px-6 h-16 flex items-center justify-between'>
          <div className='flex items-center gap-2 font-bold text-xl tracking-tight'>
            <div className='w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center text-white'>
              <Database size={20} />
            </div>
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
            <SupabaseButton variant='ghost' onClick={() => navigate('/login')} className='hidden sm:inline-flex'>
              Sign In
            </SupabaseButton>
            <SupabaseButton onClick={() => navigate('/login')}>Get Started</SupabaseButton>
          </div>
        </div>
      </nav>

      <main className='relative z-10 flex-grow'>
        {/* Hero Section */}
        <div className='container mx-auto px-6 pt-20 pb-20 text-center'>
          <div className='inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-medium text-brand-400 mb-8 animate-fade-in-up'>
            <span className='relative flex h-2 w-2'>
              <span className='animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-400 opacity-75'></span>
              <span className='relative inline-flex rounded-full h-2 w-2 bg-brand-500'></span>
            </span>
            Multibase v2.0 is now live
          </div>

          <h1 className='text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-clip-text text-transparent bg-gradient-to-br from-white to-white/60 pb-2 animate-fade-in-up [animation-delay:100ms]'>
            Scale your database <br />
            <span className='text-brand-500'>without limits.</span>
          </h1>

          <p className='text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in-up [animation-delay:200ms]'>
            The open source Firebase alternative. Build faster with a unified backend for your database, authentication,
            real-time subscriptions, and storage.
          </p>

          <div className='flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in-up [animation-delay:300ms]'>
            <SupabaseButton
              className='h-12 px-8 text-base bg-brand-500 hover:bg-brand-600 text-white'
              onClick={() => navigate('/login')}
            >
              Start your project
            </SupabaseButton>
            <SupabaseButton
              variant='secondary'
              className='h-12 px-8 text-base'
              onClick={() => window.open('https://github.com/skipper159/multibase2', '_blank')}
            >
              View Documentation
            </SupabaseButton>
          </div>
        </div>

        {/* Features Grid */}
        <div className='container mx-auto px-6 py-20 border-t border-white/5 bg-background/50 backdrop-blur-sm'>
          <div className='text-center mb-16'>
            <h2 className='text-3xl font-bold mb-4'>Everything you need to build</h2>
            <p className='text-muted-foreground max-w-2xl mx-auto'>
              Multibase gives you all the tools you need to build incredible products, from database management to
              real-time updates.
            </p>
          </div>

          <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6'>
            <FeatureCard
              icon={Database}
              title='Database'
              description="Every project is a full Postgres database, the world's most trusted relational database."
            />
            <FeatureCard
              icon={Shield}
              title='Authentication'
              description='Add user sign ups and logins, securing your data with Row Level Security.'
            />
            <FeatureCard
              icon={Activity}
              title='Realtime'
              description='Listen to database changes. Subscribe to broadcast, presence, and Postgres Changes.'
            />
            <FeatureCard
              icon={Zap}
              title='Instance Manager'
              description='Deploy, monitor, and manage multiple Supabase instances from a single dashboard.'
            />
            <FeatureCard
              icon={Layers}
              title='Storage'
              description='Store, organize, and serve large files. Any media, including images and videos.'
            />
            <FeatureCard
              icon={Layers}
              title='Edge Functions'
              description='Write custom code without deploying or scaling servers.'
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className='border-t border-white/10 bg-[#111] py-12 relative z-10'>
        <div className='container mx-auto px-6 grid grid-cols-2 md:grid-cols-4 gap-8 mb-8'>
          <div>
            <div className='flex items-center gap-2 font-bold mb-4'>
              <div className='w-6 h-6 bg-brand-500/20 rounded-md flex items-center justify-center text-brand-500'>
                <Database size={14} />
              </div>
              Multibase
            </div>
            <p className='text-sm text-muted-foreground'>The open source backend for your next application.</p>
          </div>
          <div>
            <h4 className='font-semibold mb-4 text-sm'>Product</h4>
            <ul className='space-y-2 text-sm text-muted-foreground'>
              <li>
                <a href='#' className='hover:text-brand-500 transition-colors'>
                  Database
                </a>
              </li>
              <li>
                <a href='#' className='hover:text-brand-500 transition-colors'>
                  Authentication
                </a>
              </li>
              <li>
                <a href='#' className='hover:text-brand-500 transition-colors'>
                  Storage
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className='font-semibold mb-4 text-sm'>Resources</h4>
            <ul className='space-y-2 text-sm text-muted-foreground'>
              <li>
                <a href='#' className='hover:text-brand-500 transition-colors'>
                  Documentation
                </a>
              </li>
              <li>
                <a href='#' className='hover:text-brand-500 transition-colors'>
                  API Reference
                </a>
              </li>
              <li>
                <a href='#' className='hover:text-brand-500 transition-colors'>
                  Guides
                </a>
              </li>
            </ul>
          </div>
          <div>
            <h4 className='font-semibold mb-4 text-sm'>Company</h4>
            <ul className='space-y-2 text-sm text-muted-foreground'>
              <li>
                <a href='#' className='hover:text-brand-500 transition-colors'>
                  Blog
                </a>
              </li>
              <li>
                <a href='#' className='hover:text-brand-500 transition-colors'>
                  Careers
                </a>
              </li>
              <li>
                <a href='#' className='hover:text-brand-500 transition-colors'>
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className='container mx-auto px-6 border-t border-white/5 pt-8 text-center text-sm text-muted-foreground'>
          &copy; 2026 Multibase Inc. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
