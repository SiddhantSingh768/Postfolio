import { NavLink, useNavigate }     from 'react-router-dom';
import {
  LayoutDashboard, Users, FolderOpen,
  FileText, Settings, ChevronRight, Zap
} from 'lucide-react';
import { cn }       from '../../utils/cn';
import { useAuth }  from '../../context/AuthContext';

const NAV_ITEMS = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/clients',   icon: Users,           label: 'Clients'   },
  { to: '/projects',  icon: FolderOpen,      label: 'Projects'  },
  { to: '/invoices',  icon: FileText,        label: 'Invoices'  },
  { to: '/settings',  icon: Settings,        label: 'Settings'  },
];

export const Sidebar = ({ collapsed, onToggle, onNavigate }) => {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className={cn(
      'h-screen flex flex-col border-r border-[var(--border)]',
      'bg-[var(--bg-secondary)] transition-all duration-200',
      collapsed ? 'w-14' : 'w-56'
    )}>
      {/* Logo */}
      <div className={cn(
        'flex items-center h-14 border-b border-[var(--border)] px-4 flex-shrink-0',
        collapsed ? 'justify-center' : 'gap-2.5'
      )}>
        <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center flex-shrink-0">
          <Zap className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <span className="font-semibold text-sm text-[var(--text-primary)] tracking-tight">
            Postfolio
          </span>
        )}
      </div>

      {/* Navbar */}
      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            onClick={onNavigate}
            className={({ isActive }) => cn(
              'flex items-center rounded-md transition-colors duration-100',
              'text-sm font-medium group',
              collapsed
                ? 'justify-center w-10 h-10 mx-auto'
                : 'gap-2.5 h-9 px-2.5',
              isActive
                ? 'bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400'
                : 'text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]'
            )}
            title={collapsed ? label : undefined}
          >
            <Icon className="w-4 h-4 flex-shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-[var(--border)] p-2 flex-shrink-0">
        {!collapsed && (
          <div
            onClick={() => { navigate('/settings'); onNavigate?.(); }}
            className="flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-[var(--bg-tertiary)] cursor-pointer mb-1 transition-colors"
          >
            <div className="w-6 h-6 rounded-full bg-brand-600 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-semibold text-white">
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                {user?.name}
              </p>
              <p className="text-xs text-[var(--text-muted)] truncate">
                {user?.email}
              </p>
            </div>
          </div>
        )}

        {/* Collapse toggle — desktop only */}
        <button
          onClick={onToggle}
          className={cn(
            'hidden lg:flex items-center justify-center rounded-md h-8 w-full',
            'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]',
            'transition-colors duration-100'
          )}
        >
          <ChevronRight className={cn(
            'w-4 h-4 transition-transform duration-200',
            collapsed ? '' : 'rotate-180'
          )} />
        </button>
      </div>
    </aside>
  );
};