import { Menu, Sun, Moon } from 'lucide-react';
import { useTheme }        from '../../context/ThemeContext';
import { cn }              from '../../utils/cn';

export const Topbar = ({ title, subtitle, actions, onMenuClick }) => {
  const { toggle, isDark } = useTheme();

  return (
    <header className="h-14 flex items-center justify-between px-4 sm:px-6 border-b border-[var(--border)] bg-[var(--bg-secondary)] flex-shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        {/* Mobile burger */}
        <button
          onClick={onMenuClick}
          className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] transition-colors lg:hidden flex-shrink-0"
        >
          <Menu className="w-4 h-4" />
        </button>

        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-[var(--text-primary)] truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-xs text-[var(--text-muted)] truncate hidden sm:block">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="hidden sm:flex items-center gap-2">
          {actions}
        </div>

        <button
          onClick={toggle}
          className="w-8 h-8 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          title={isDark ? 'Light mode' : 'Dark mode'}
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>
      </div>
    </header>
  );
};