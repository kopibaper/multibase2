interface PageHeaderProps {
  children?: React.ReactNode;
}

export default function PageHeader({ children }: PageHeaderProps) {
  return (
    <header className='border-b border-border bg-card'>
      <div className='container mx-auto px-4 sm:px-6 py-4'>
        {/* Page-specific content */}
        {children && <div>{children}</div>}
      </div>
    </header>
  );
}
