import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { Book, Code, Layers, FileText } from 'lucide-react';
import { cn } from '../lib/utils';

import Navbar from '../components/Navbar';

interface SetupLayoutProps {}

const SidebarLink = ({ to, icon: Icon, children }: { to: string; icon: any; children: React.ReactNode }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      cn(
        'flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
        isActive
          ? 'bg-brand-500/10 text-brand-500'
          : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
      )
    }
  >
    <Icon className='w-4 h-4' />
    {children}
  </NavLink>
);

const SidebarGroup = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div className='mb-6'>
    <h4 className='px-3 mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/50'>{title}</h4>
    <div className='space-y-1'>{children}</div>
  </div>
);

export default function SetupLayout({}: SetupLayoutProps) {
  return (
    <div className='min-h-screen flex flex-col'>
      <Navbar />
      <div className='flex flex-1 pt-16 container mx-auto'>
        {/* Sidebar */}
        <aside className='w-64 border-r border-border h-full overflow-y-auto py-6 pr-6 hidden md:block'>
          <SidebarGroup title='Getting Started'>
            <SidebarLink to='/setup/getting-started/requirements' icon={Book}>
              Requirements
            </SidebarLink>
            <SidebarLink to='/setup/getting-started/hosting' icon={Book}>
              Choosing a VPS
            </SidebarLink>
          </SidebarGroup>

          <SidebarGroup title='Server Setup'>
            <SidebarLink to='/setup/server-setup/linux-basics' icon={Code}>
              Linux Basics
            </SidebarLink>
            <SidebarLink to='/setup/server-setup/dependencies' icon={Code}>
              Dependencies
            </SidebarLink>
          </SidebarGroup>

          <SidebarGroup title='Domain & DNS'>
            <SidebarLink to='/setup/domain-dns/domain-setup' icon={Layers}>
              Domain Setup
            </SidebarLink>
            <SidebarLink to='/setup/domain-dns/dns-settings' icon={Layers}>
              DNS Settings
            </SidebarLink>
          </SidebarGroup>

          <SidebarGroup title='Deployment'>
            <SidebarLink to='/setup/deployment/single-server' icon={FileText}>
              Single Server
            </SidebarLink>
            <SidebarLink to='/setup/deployment/split-hosting' icon={FileText}>
              Split Hosting
            </SidebarLink>
            <SidebarLink to='/setup/deployment/github-actions' icon={FileText}>
              GitHub Actions
            </SidebarLink>
          </SidebarGroup>

          <SidebarGroup title='Configuration'>
            <SidebarLink to='/setup/configuration/environment' icon={Code}>
              Environment
            </SidebarLink>
            <SidebarLink to='/setup/configuration/nginx' icon={Code}>
              Nginx
            </SidebarLink>
            <SidebarLink to='/setup/configuration/pm2' icon={Code}>
              PM2
            </SidebarLink>
          </SidebarGroup>

          <SidebarGroup title='Reference'>
            <SidebarLink to='/setup/general/overview' icon={Book}>
              Overview
            </SidebarLink>
            <SidebarLink to='/setup/general/versions' icon={Layers}>
              Version History
            </SidebarLink>
            <SidebarLink to='/setup/features/roadmap-1.1' icon={FileText}>
              v1.1 Roadmap
            </SidebarLink>
            <SidebarLink to='/setup/features/roadmap-1.2' icon={FileText}>
              v1.2 Future
            </SidebarLink>
            <SidebarLink to='/setup/reference/scripts' icon={Code}>
              Scripts Guide
            </SidebarLink>
          </SidebarGroup>
        </aside>

        {/* Main Content */}
        <main className='flex-1 overflow-y-auto p-6 md:px-12'>
          <div className='max-w-4xl mx-auto'>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
