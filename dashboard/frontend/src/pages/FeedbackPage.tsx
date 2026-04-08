import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Lightbulb, Bug, MessageSquarePlus, Clock, InboxIcon, Menu, X, ChevronDown } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from '../components/AuthModal';
import { createPortal } from 'react-dom';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

// Reused from LandingPage
const SupabaseButton = ({ className, variant = 'primary', children, ...props }: any) => {
  const baseStyles =
    'inline-flex items-center justify-center rounded-md text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none ring-offset-background';
  const variants: Record<string, string> = {
    primary:
      'bg-brand-500 text-white hover:bg-brand-600 shadow-[0_0_10px_rgba(62,207,142,0.5)] hover:shadow-[0_0_20px_rgba(62,207,142,0.6)]',
    secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
    outline: 'border border-input hover:bg-accent hover:text-accent-foreground',
    ghost: 'hover:bg-accent hover:text-accent-foreground',
  };
  const variantClasses = variants[variant] || variants.primary;
  return (
    <button className={`${baseStyles} ${variantClasses} h-10 py-2 px-4 ${className}`} {...props}>
      {children}
    </button>
  );
};

const URGENCY_OPTIONS = [
  { value: 'low', label: 'Low', color: 'text-slate-400 border-slate-500/40 bg-slate-500/10 hover:bg-slate-500/20 data-[active=true]:bg-slate-500/25 data-[active=true]:border-slate-400' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-400 border-yellow-500/40 bg-yellow-500/10 hover:bg-yellow-500/20 data-[active=true]:bg-yellow-500/25 data-[active=true]:border-yellow-400' },
  { value: 'high', label: 'High', color: 'text-orange-400 border-orange-500/40 bg-orange-500/10 hover:bg-orange-500/20 data-[active=true]:bg-orange-500/25 data-[active=true]:border-orange-400' },
  { value: 'critical', label: 'Critical', color: 'text-red-400 border-red-500/40 bg-red-500/10 hover:bg-red-500/20 data-[active=true]:bg-red-500/25 data-[active=true]:border-red-400' },
];

const URGENCY_BADGE: Record<string, string> = {
  low: 'text-slate-400 bg-slate-500/10 border border-slate-500/30',
  medium: 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/30',
  high: 'text-orange-400 bg-orange-500/10 border border-orange-500/30',
  critical: 'text-red-400 bg-red-500/10 border border-red-500/30',
};

const URGENCY_LABEL: Record<string, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  critical: 'Critical',
};

type Status = 'open' | 'in_progress' | 'resolved' | 'closed';

const STATUS_OPTIONS: { value: Status; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const STATUS_BADGE: Record<Status, string> = {
  open: 'text-sky-400 bg-sky-500/10 border border-sky-500/30',
  in_progress: 'text-yellow-400 bg-yellow-500/10 border border-yellow-500/30',
  resolved: 'text-brand-400 bg-brand-500/10 border border-brand-500/30',
  closed: 'text-slate-400 bg-slate-500/10 border border-slate-500/30',
};

const STATUS_LABEL: Record<Status, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
};

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

type FeedbackItem = {
  id: number;
  type: 'feature' | 'bug';
  title: string;
  description: string;
  urgency: string;
  authorName: string | null;
  status: string;
  createdAt: string;
};

const defaultForm = {
  type: 'feature' as 'feature' | 'bug',
  title: '',
  description: '',
  urgency: 'medium',
  authorName: '',
  authorEmail: '',
  website: '', // honeypot
};

export default function FeedbackPage() {
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [form, setForm] = useState(defaultForm);

  // Redirect if feedback is disabled
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/settings/public`)
      .then((r) => r.json())
      .then((d) => { if (d.feedbackEnabled === false) navigate('/', { replace: true }); })
      .catch(() => {});
  }, [navigate]);
  const [filter, setFilter] = useState<'all' | 'feature' | 'bug'>('all');
  const [openDropdown, setOpenDropdown] = useState<number | null>(null);
  const [detailItem, setDetailItem] = useState<FeedbackItem | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authView, setAuthView] = useState<'login' | 'register' | 'forgot'>('login');

  const openAuth = (view: 'login' | 'register' | 'forgot') => {
    setAuthView(view);
    setAuthModalOpen(true);
  };

  const { data, isLoading } = useQuery<{ feedback: FeedbackItem[] }>({
    queryKey: ['feedback', isAdmin],
    queryFn: () => {
      const token = localStorage.getItem('auth_token');
      const url = isAdmin ? `${API_BASE_URL}/api/feedback?all=true` : `${API_BASE_URL}/api/feedback`;
      return fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} }).then((r) => {
        if (!r.ok) throw new Error('Failed to load feedback');
        return r.json();
      });
    },
  });

  const { mutate, isPending } = useMutation({
    mutationFn: async (body: typeof defaultForm) => {
      const res = await fetch(`${API_BASE_URL}/api/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.status === 429) {
        throw { status: 429, message: 'Too many submissions. Please try again in 1 hour.' };
      }
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw { status: res.status, message: err.error || 'Submission failed.' };
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      toast.success('Feedback submitted! Thanks for your contribution.');
      setForm(defaultForm);
    },
    onError: (err: any) => {
      toast.error(err.message || 'Submission failed.');
    },
  });

  const { mutate: updateStatus } = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: Status }) => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(`${API_BASE_URL}/api/feedback/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Update failed.');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['feedback'] });
      toast.success('Status updated.');
    },
    onError: (err: any) => {
      toast.error(err.message || 'Failed to update status.');
    },
  });

  const items = data?.feedback ?? [];
  const filtered = filter === 'all' ? items : items.filter((i) => i.type === filter);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.website) return; // honeypot triggered
    if (!form.title.trim() || form.title.length < 5) {
      toast.error('Title must be at least 5 characters.');
      return;
    }
    if (!form.description.trim() || form.description.length < 10) {
      toast.error('Description must be at least 10 characters.');
      return;
    }
    mutate(form);
  }

  return (
    <div className='min-h-screen bg-background text-foreground flex flex-col overflow-hidden relative selection:bg-brand-500/30'>
      {/* Background gradients — identical to LandingPage */}
      <div className='fixed inset-0 z-0 pointer-events-none'>
        <div className='absolute top-0 left-1/4 w-[500px] h-[500px] bg-brand-500/10 rounded-full blur-[100px] -translate-y-1/2' />
        <div className='absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-brand-900/10 rounded-full blur-[100px] translate-y-1/2' />
      </div>

      {/* Navbar — identical structure to LandingPage */}
      <nav className='z-10 border-b border-white/5 backdrop-blur-md sticky top-0 bg-background/80'>
        <div className='container mx-auto px-4 sm:px-6 h-16 flex items-center justify-between'>
          <button
            onClick={() => navigate('/')}
            className='flex items-center gap-2 font-bold text-xl tracking-tight flex-shrink-0 hover:opacity-80 transition-opacity'
          >
            <img src='/logo.png' alt='Multibase' className='w-8 h-8' />
            Multibase
          </button>

          {/* Desktop Nav */}
          <div className='hidden sm:flex items-center gap-4'>
            <a
              href='https://supabase.com/docs'
              target='_blank'
              rel='noopener noreferrer'
              className='text-sm text-muted-foreground hover:text-foreground transition-colors'
            >
              Supabase Docs
            </a>
            <a href='/setup' className='text-sm text-muted-foreground hover:text-foreground transition-colors'>
              Setup Guide
            </a>
            {user ? (
              <>
                <SupabaseButton onClick={() => navigate('/workspace')}>Workspace</SupabaseButton>
                {isAdmin && (
                  <SupabaseButton
                    variant='ghost'
                    onClick={() => navigate('/dashboard')}
                    className='text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20'
                  >
                    Dashboard
                  </SupabaseButton>
                )}
              </>
            ) : (
              <>
                <SupabaseButton variant='ghost' onClick={() => openAuth('login')}>
                  Sign In
                </SupabaseButton>
                <SupabaseButton onClick={() => openAuth('login')}>Get Started</SupabaseButton>
              </>
            )}
          </div>

          {/* Mobile Burger */}
          <button
            className='sm:hidden p-2 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-lg transition-colors'
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label='Toggle menu'
          >
            {mobileMenuOpen ? <X className='w-5 h-5' /> : <Menu className='w-5 h-5' />}
          </button>
        </div>

        {/* Mobile Dropdown */}
        {mobileMenuOpen && (
          <div className='sm:hidden border-t border-white/5 bg-background/95 backdrop-blur-md px-4 py-4 flex flex-col gap-2'>
            <a
              href='https://supabase.com/docs'
              target='_blank'
              rel='noopener noreferrer'
              className='text-sm text-muted-foreground hover:text-foreground transition-colors py-2 px-2 rounded-lg hover:bg-white/5'
              onClick={() => setMobileMenuOpen(false)}
            >
              Supabase Docs
            </a>
            <a
              href='/setup'
              className='text-sm text-muted-foreground hover:text-foreground transition-colors py-2 px-2 rounded-lg hover:bg-white/5'
              onClick={() => setMobileMenuOpen(false)}
            >
              Setup Guide
            </a>
            <div className='border-t border-white/5 my-1' />
            {user ? (
              <>
                <SupabaseButton
                  className='w-full justify-center'
                  onClick={() => { navigate('/workspace'); setMobileMenuOpen(false); }}
                >
                  Workspace
                </SupabaseButton>
                {isAdmin && (
                  <SupabaseButton
                    variant='ghost'
                    className='w-full justify-center text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20'
                    onClick={() => { navigate('/dashboard'); setMobileMenuOpen(false); }}
                  >
                    Dashboard
                  </SupabaseButton>
                )}
              </>
            ) : (
              <>
                <SupabaseButton
                  variant='ghost'
                  className='w-full justify-center'
                  onClick={() => { openAuth('login'); setMobileMenuOpen(false); }}
                >
                  Sign In
                </SupabaseButton>
                <SupabaseButton
                  className='w-full justify-center'
                  onClick={() => { openAuth('login'); setMobileMenuOpen(false); }}
                >
                  Get Started
                </SupabaseButton>
              </>
            )}
          </div>
        )}
      </nav>

      <main className='container mx-auto px-4 sm:px-6 py-16 max-w-3xl relative z-10'>
        {/* Hero */}
        <div className='text-center mb-12'>
          <div className='inline-flex items-center justify-center w-14 h-14 rounded-xl bg-brand-500/10 text-brand-500 mb-5'>
            <MessageSquarePlus className='w-7 h-7' />
          </div>
          <h1 className='text-3xl sm:text-4xl font-bold mb-3'>Features & Issues</h1>
          <p className='text-muted-foreground max-w-md mx-auto'>
            Share your ideas or report bugs. No account required.
          </p>
        </div>

        {/* Submission Form */}
        <div className='glass-card p-6 sm:p-8 rounded-xl border border-white/10 bg-card/50 backdrop-blur-sm mb-6'>
          <form onSubmit={handleSubmit} className='space-y-5'>
            {/* Type toggle */}
            <div className='grid grid-cols-2 gap-3'>
              {(['feature', 'bug'] as const).map((t) => (
                <button
                  key={t}
                  type='button'
                  onClick={() => setForm((f) => ({ ...f, type: t }))}
                  className={`flex items-center justify-center gap-2 py-3 rounded-lg border text-sm font-medium transition-all ${
                    form.type === t
                      ? t === 'feature'
                        ? 'border-brand-500 bg-brand-500/15 text-brand-400'
                        : 'border-red-500 bg-red-500/15 text-red-400'
                      : 'border-white/10 bg-background/40 text-muted-foreground hover:border-white/20 hover:text-foreground'
                  }`}
                >
                  {t === 'feature' ? <Lightbulb className='w-4 h-4' /> : <Bug className='w-4 h-4' />}
                  {t === 'feature' ? 'Feature Request' : 'Bug Report'}
                </button>
              ))}
            </div>

            {/* Title */}
            <div>
              <label className='block text-sm font-medium mb-1.5'>
                Title <span className='text-red-400'>*</span>
              </label>
              <div className='relative'>
                <input
                  type='text'
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  maxLength={120}
                  placeholder='Short, descriptive title…'
                  className='w-full bg-background/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30 transition-colors pr-14'
                  required
                />
                <span className='absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground'>
                  {form.title.length}/120
                </span>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className='block text-sm font-medium mb-1.5'>
                Description <span className='text-red-400'>*</span>
              </label>
              <div className='relative'>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  maxLength={2000}
                  rows={5}
                  placeholder='Describe the feature or bug in detail…'
                  className='w-full bg-background/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30 transition-colors resize-none'
                  required
                />
                <span className='absolute right-3 bottom-2.5 text-xs text-muted-foreground'>
                  {form.description.length}/2000
                </span>
              </div>
            </div>

            {/* Urgency */}
            <div>
              <label className='block text-sm font-medium mb-1.5'>
                Urgency <span className='text-red-400'>*</span>
              </label>
              <div className='grid grid-cols-4 gap-2'>
                {URGENCY_OPTIONS.map((u) => (
                  <button
                    key={u.value}
                    type='button'
                    data-active={form.urgency === u.value}
                    onClick={() => setForm((f) => ({ ...f, urgency: u.value }))}
                    className={`py-2 rounded-lg border text-xs font-medium transition-all ${u.color}`}
                  >
                    {u.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Optional fields */}
            <div className='grid grid-cols-1 sm:grid-cols-2 gap-4'>
              <div>
                <label className='block text-sm font-medium mb-1.5 text-muted-foreground'>
                  Name (optional)
                </label>
                <input
                  type='text'
                  value={form.authorName}
                  onChange={(e) => setForm((f) => ({ ...f, authorName: e.target.value }))}
                  maxLength={80}
                  placeholder='Your name'
                  className='w-full bg-background/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30 transition-colors'
                />
              </div>
              <div>
                <label className='block text-sm font-medium mb-1.5 text-muted-foreground'>
                  Email (optional, for follow-up)
                </label>
                <input
                  type='email'
                  value={form.authorEmail}
                  onChange={(e) => setForm((f) => ({ ...f, authorEmail: e.target.value }))}
                  placeholder='you@example.com'
                  className='w-full bg-background/50 border border-white/10 rounded-lg px-4 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-brand-500/50 focus:ring-1 focus:ring-brand-500/30 transition-colors'
                />
              </div>
            </div>

            {/* Honeypot — hidden from humans, bots fill it */}
            <input
              type='text'
              name='website'
              value={form.website}
              onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
              tabIndex={-1}
              autoComplete='off'
              aria-hidden='true'
              style={{ display: 'none' }}
            />

            <SupabaseButton type='submit' disabled={isPending} className='w-full h-11 text-base mt-1'>
              {isPending ? 'Submitting…' : 'Submit Feedback'}
            </SupabaseButton>
          </form>
        </div>

        {/* Divider */}
        <div className='flex items-center gap-4 my-12'>
          <div className='flex-1 h-px bg-white/10' />
          <span className='text-xs text-muted-foreground uppercase tracking-widest'>Submissions</span>
          <div className='flex-1 h-px bg-white/10' />
        </div>

        {/* Submissions list */}
        <div>
          <div className='flex items-center justify-between mb-5 flex-wrap gap-3'>
            <h2 className='text-xl font-semibold'>
              {isAdmin ? 'All Submissions' : 'Open Submissions'}
            </h2>
            <div className='flex gap-2'>
              {(['all', 'feature', 'bug'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    filter === f
                      ? 'border-brand-500/50 bg-brand-500/15 text-brand-400'
                      : 'border-white/10 bg-background/40 text-muted-foreground hover:border-white/20 hover:text-foreground'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'feature' ? 'Features' : 'Bugs'}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className='space-y-3'>
              {[...Array(3)].map((_, i) => (
                <div key={i} className='h-24 rounded-xl border border-white/10 bg-card/30 animate-pulse' />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className='text-center py-16 text-muted-foreground'>
              <InboxIcon className='w-10 h-10 mx-auto mb-3 opacity-30' />
              <p>No submissions found.</p>
            </div>
          ) : (
            <div className='space-y-3'>
              {filtered.map((item) => (
                <div
                  key={item.id}
                  className='flex gap-4 p-4 sm:p-5 rounded-xl border border-white/10 bg-card/50 backdrop-blur-sm hover:border-white/20 transition-colors'
                >
                  <div
                    className={`flex-shrink-0 mt-0.5 w-9 h-9 rounded-lg flex items-center justify-center ${
                      item.type === 'feature' ? 'bg-brand-500/10 text-brand-400' : 'bg-red-500/10 text-red-400'
                    }`}
                  >
                    {item.type === 'feature' ? <Lightbulb className='w-4 h-4' /> : <Bug className='w-4 h-4' />}
                  </div>

                  <div className='flex-1 min-w-0'>
                    <div className='flex items-start gap-2 flex-wrap'>
                      <span className='font-medium text-sm leading-snug flex-1'>{item.title}</span>
                      <div className='flex items-center gap-1.5 flex-shrink-0'>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${URGENCY_BADGE[item.urgency]}`}>
                          {URGENCY_LABEL[item.urgency] ?? item.urgency}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[item.status as Status] ?? STATUS_BADGE.open}`}>
                          {STATUS_LABEL[item.status as Status] ?? item.status}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={() => setDetailItem(item)}
                      className='text-left text-xs text-muted-foreground mt-1 line-clamp-2 hover:text-foreground transition-colors cursor-pointer w-full'
                    >
                      {item.description}
                    </button>
                    <div className='flex items-center justify-between mt-2'>
                      <div className='flex items-center gap-3 text-xs text-muted-foreground'>
                        {item.authorName && <span>{item.authorName}</span>}
                        <span className='flex items-center gap-1'>
                          <Clock className='w-3 h-3' />
                          {timeAgo(item.createdAt)}
                        </span>
                      </div>
                      {isAdmin && (
                        <div className='relative'>
                          <button
                            onClick={() => setOpenDropdown(openDropdown === item.id ? null : item.id)}
                            className='flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground border border-white/10 hover:border-white/20 rounded-md px-2 py-1 transition-colors'
                          >
                            Set status <ChevronDown className='w-3 h-3' />
                          </button>
                          {openDropdown === item.id && (
                              <div className='absolute right-0 bottom-full mb-1 flex flex-col w-36 rounded-lg border border-white/20 shadow-xl z-20 overflow-hidden' style={{ backgroundColor: '#202020' }}>
                                {STATUS_OPTIONS.map((s) => (
                                  <button
                                    key={s.value}
                                    onClick={() => { updateStatus({ id: item.id, status: s.value }); setOpenDropdown(null); }}
                                    className={`text-left px-3 py-2 text-xs transition-colors hover:bg-white/10 ${
                                      item.status === s.value ? 'text-brand-400 font-medium' : 'text-muted-foreground'
                                    }`}
                                  >
                                    {s.label}
                                  </button>
                                ))}
                              </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {detailItem && createPortal(
        <div
          className='fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm'
          onClick={() => setDetailItem(null)}
        >
          <div
            className='relative w-full max-w-lg rounded-xl border border-white/15 bg-[#1a1a1a] shadow-2xl p-6'
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setDetailItem(null)}
              className='absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors'
              aria-label='Close'
            >
              <X className='w-4 h-4' />
            </button>

            <div className='flex items-center gap-3 mb-4'>
              <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
                detailItem.type === 'feature' ? 'bg-brand-500/10 text-brand-400' : 'bg-red-500/10 text-red-400'
              }`}>
                {detailItem.type === 'feature' ? <Lightbulb className='w-4 h-4' /> : <Bug className='w-4 h-4' />}
              </div>
              <div className='flex items-center gap-1.5 flex-wrap'>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${URGENCY_BADGE[detailItem.urgency]}`}>
                  {URGENCY_LABEL[detailItem.urgency] ?? detailItem.urgency}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE[detailItem.status as Status] ?? STATUS_BADGE.open}`}>
                  {STATUS_LABEL[detailItem.status as Status] ?? detailItem.status}
                </span>
              </div>
            </div>

            <h3 className='font-semibold text-base leading-snug mb-3'>{detailItem.title}</h3>
            <p className='text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap'>{detailItem.description}</p>

            <div className='flex items-center gap-3 mt-5 pt-4 border-t border-white/10 text-xs text-muted-foreground'>
              {detailItem.authorName && <span>{detailItem.authorName}</span>}
              <span className='flex items-center gap-1'>
                <Clock className='w-3 h-3' />
                {timeAgo(detailItem.createdAt)}
              </span>
            </div>
          </div>
        </div>,
        document.body
      )}

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialView={authView}
      />
    </div>
  );
}
