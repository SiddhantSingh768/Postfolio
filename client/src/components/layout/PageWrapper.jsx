import { useState } from 'react';
import { Menu, X }  from 'lucide-react';
import { Sidebar }  from './Sidebar';
import { Topbar }   from './Topbar';
import { cn }       from '../../utils/cn';

export const PageWrapper = ({ title, subtitle, actions, children }) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-[var(--bg-primary)] overflow-hidden">
      {/* Mobile sidebar backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar — hidden on mobile, toggled via burger */}
      <div className={cn(
        'fixed inset-y-0 left-0 z-40 lg:relative lg:z-auto',
        'transform transition-transform duration-200',
        mobileSidebarOpen
          ? 'translate-x-0'
          : '-translate-x-full lg:translate-x-0'
      )}>
        <Sidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(c => !c)}
          onNavigate={() => setMobileSidebarOpen(false)}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar
          title={title}
          subtitle={subtitle}
          actions={actions}
          onMenuClick={() => setMobileSidebarOpen(o => !o)}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
};