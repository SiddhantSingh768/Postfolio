import { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, XCircle, AlertCircle, X } from 'lucide-react';
import { cn } from '../../utils/cn';

const ToastContext = createContext(null);

let toastId = 0;

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const add = useCallback((message, type = 'success') => {
    const id = ++toastId;
    setToasts(t => [...t, { id, message, type }]);
    setTimeout(() => {
      setToasts(t => t.filter(toast => toast.id !== id));
    }, 4000);
  }, []);

  const remove = useCallback((id) => {
    setToasts(t => t.filter(toast => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ success: (m) => add(m, 'success'), error: (m) => add(m, 'error'), info: (m) => add(m, 'info') }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={cn(
              'flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border',
              'animate-slide-up max-w-sm text-sm',
              toast.type === 'success' && 'bg-[var(--bg-secondary)] border-success/30 text-[var(--text-primary)]',
              toast.type === 'error'   && 'bg-[var(--bg-secondary)] border-danger/30 text-[var(--text-primary)]',
              toast.type === 'info'    && 'bg-[var(--bg-secondary)] border-brand-300 text-[var(--text-primary)]',
            )}
          >
            {toast.type === 'success' && <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />}
            {toast.type === 'error'   && <XCircle     className="w-4 h-4 text-danger  flex-shrink-0" />}
            {toast.type === 'info'    && <AlertCircle className="w-4 h-4 text-brand-600 flex-shrink-0" />}
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={() => remove(toast.id)}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
};