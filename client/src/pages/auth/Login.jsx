import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { Zap, Mail, Lock, ArrowRight } from 'lucide-react';
import { useAuth }           from '../../context/AuthContext';
import { authApi }           from '../../api/endpoints/auth.api';
import { Input }             from '../../components/ui/Input';
import { Button }            from '../../components/ui/Button';
import { ThemeToggle }       from '../../components/ui/ThemeToggle';
import { cn }                from '../../utils/cn';
import { AuthLayout }        from './AuthLayout';
import { ErrorBox }          from './ErrorBox';

export const Login = () => {
  const { login, setUser, setToken } = useAuth();
  const navigate        = useNavigate();
  const [searchParams]  = useSearchParams();
  const location        = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Handle Google OAuth callback — token comes back in URL query param
  useEffect(() => {
    const token = searchParams.get('token');
    const err   = searchParams.get('error');

    if (err) {
      setError('Google sign-in failed. Please try again.');
      return;
    }

    if (token) {
      // Store the access token and fetch user info
      window.__postfolioAccessToken = token;
      import('../../api/endpoints/auth.api').then(({ authApi }) => {
        import('../../api/axiosClient').then(({ default: axiosClient }) => {
          axiosClient.get('/auth/me').then(res => {
            setToken(token);
            setUser(res.data.data.user);
            navigate('/dashboard', { replace: true });
          }).catch(() => {
            // /auth/me doesn't exist yet — navigate anyway with token
            setToken(token);
            navigate('/dashboard', { replace: true });
          });
        });
      });
    }
  }, []);

  useEffect(() => {
    const state = location.state;
    if (state?.verified && state?.message) {
      setSuccessMsg(state.message);
      // Clear the state from history
      window.history.replaceState({}, document.title);
    }
  }, [location]);



const handleSubmit = async (e) => {
  e.preventDefault();
  setError('');
  setLoading(true);
  try {
    await login(form.email, form.password);
    // Navigate to the page they were trying to visit, or dashboard
    const from = location.state?.from?.pathname || '/dashboard';
    navigate(from, { replace: true });
  } catch (err) {
    const code    = err.response?.data?.code;
    const message = err.response?.data?.message || 'Invalid email or password';

    // ONLY redirect to verify-email for this specific error code
    // Do NOT redirect for any other error
    if (code === 'EMAIL_NOT_VERIFIED') {
      navigate('/verify-email', {
        state: { email: form.email },
        replace: false
      });
      return;
    }

    // For everything else (wrong password, user not found, etc.)
    // just show the error message on this page
    setError(message);
  } finally {
    setLoading(false);
  }
};
  return (
    <AuthLayout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-1">
          Welcome back
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Sign in to your workspace
        </p>
      </div>

      {/* Google OAuth button */}
      <button
        onClick={() => authApi.googleLogin()}
        className={cn(
          'w-full flex items-center justify-center gap-2.5 h-9 px-4',
          'border border-[var(--border)] rounded-md text-sm font-medium',
          'text-[var(--text-primary)] bg-[var(--bg-secondary)]',
          'hover:bg-[var(--bg-tertiary)] transition-colors duration-150 mb-4'
        )}
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Continue with Google
      </button>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-[var(--border)]" />
        <span className="text-xs text-[var(--text-muted)]">or</span>
        <div className="flex-1 h-px bg-[var(--border)]" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          icon={<Mail className="w-4 h-4" />}
          autoComplete="email"
          required
        />
        <div>
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={form.password}
            onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
            icon={<Lock className="w-4 h-4" />}
            autoComplete="current-password"
            required
          />
          <div className="flex justify-end mt-1.5">
            <Link
              to="/forgot-password"
              className="text-xs text-brand-600 dark:text-brand-400 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        {successMsg && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-success-light border border-success/20 mb-4">
            <span className="text-success text-xs">✓</span>
            <p className="text-xs text-success-dark">{successMsg}</p>
          </div>
        )}

        {error && <ErrorBox message={error} />}

        <Button type="submit" loading={loading} className="w-full">
          Sign in
          <ArrowRight className="w-4 h-4" />
        </Button>
      </form>

      <p className="text-center text-xs text-[var(--text-muted)] mt-6">
        Don't have an account?{' '}
        <Link to="/register" className="text-brand-600 dark:text-brand-400 hover:underline font-medium">
          Create one
        </Link>
      </p>
    </AuthLayout>
  );
};


