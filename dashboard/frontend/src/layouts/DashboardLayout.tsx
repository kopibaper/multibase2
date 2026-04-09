import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import DashboardNavbar from '../components/DashboardNavbar';
import AiChatPanel from '../components/AiChatPanel';

export default function DashboardLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className='min-h-screen bg-background text-foreground relative'>
      {/* Background Gradients */}
      <div className='fixed inset-0 z-0 pointer-events-none overflow-hidden'>
        <div className='absolute top-0 left-1/4 w-[600px] h-[600px] bg-brand-500/8 rounded-full blur-[120px] -translate-y-1/2' />
        <div className='absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-brand-900/10 rounded-full blur-[100px] translate-y-1/2' />
        <div className='absolute top-1/2 right-0 w-[400px] h-[400px] bg-purple-500/5 rounded-full blur-[100px] translate-x-1/2' />
      </div>

      {/* Top Navbar */}
      <DashboardNavbar
        mobileMenuOpen={sidebarOpen}
        onMobileMenuToggle={() => setSidebarOpen(!sidebarOpen)}
      />

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className='lg:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40 top-16'
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
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

      {/* Main Content */}
      <main className='fixed top-16 left-0 lg:left-64 right-0 bottom-0 overflow-y-auto z-10'>
        <Outlet />
      </main>

      {/* AI Chat Overlay */}
      <AiChatPanel />
    </div>
  );
}
