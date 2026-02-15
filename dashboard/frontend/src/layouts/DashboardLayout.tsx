import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import { Menu, X } from 'lucide-react';
import Sidebar from '../components/Sidebar';
import AiChatPanel from '../components/AiChatPanel';

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className='min-h-screen bg-background text-foreground relative'>
      {/* Background Gradients - matching Landing Page */}
      <div className='fixed inset-0 z-0 pointer-events-none overflow-hidden'>
        <div className='absolute top-0 left-1/4 w-[600px] h-[600px] bg-brand-500/8 rounded-full blur-[120px] -translate-y-1/2' />
        <div className='absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-brand-900/10 rounded-full blur-[100px] translate-y-1/2' />
        <div className='absolute top-1/2 right-0 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px] translate-x-1/2' />
      </div>

      {/* Mobile Header */}
      <div className='lg:hidden fixed top-0 left-0 right-0 h-14 glass-panel z-50 flex items-center justify-between px-4'>
        <div className='flex items-center gap-3'>
          <img src='/logo.png' alt='Multibase' className='w-7 h-7' />
          <span className='font-bold text-foreground'>Multibase</span>
        </div>
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className='p-2 text-muted-foreground hover:text-foreground hover:bg-white/10 rounded-lg transition-colors'
        >
          {sidebarOpen ? <X className='w-5 h-5' /> : <Menu className='w-5 h-5' />}
        </button>
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className='lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40'
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - hidden on mobile, visible on lg+ */}
      <div
        className={`
          fixed left-0 top-0 h-screen z-40
          transform transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <Sidebar onNavigate={() => setSidebarOpen(false)} />
      </div>

      {/* Main Content - full width on mobile, margin on lg+ */}
      <main className='lg:ml-64 min-h-screen relative z-10 pt-14 lg:pt-0'>
        <Outlet />
      </main>

      {/* AI Chat Overlay */}
      <AiChatPanel />
    </div>
  );
}
