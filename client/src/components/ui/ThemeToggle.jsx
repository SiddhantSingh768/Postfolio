import { Sun, Moon } from 'lucide-react';
import { useTheme }  from '../../context/ThemeContext';
import { cn }        from '../../utils/cn';

export const ThemeToggle = ({ className }) => {
  const { toggle, isDark } = useTheme();
  return (
    <button
      onClick={toggle}
      className={cn(
        'w-8 h-8 rounded-md flex items-center justify-center',
        'text-[var(--text-muted)] hover:bg-[var(--bg-tertiary)]',
        'hover:text-[var(--text-primary)] transition-colors duration-150',
        className
      )}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
};