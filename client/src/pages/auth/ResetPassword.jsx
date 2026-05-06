import { useState }             from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Lock, ArrowRight, Eye, EyeOff }      from 'lucide-react';
import { authApi }  from '../../api/endpoints/auth.api';
import { Button }   from '../../components/ui/Button';
import { AuthLayout } from './AuthLayout';
import { ErrorBox }   from './ErrorBox';
import { cn }         from '../../utils/cn';

export const ResetPassword = () => {
  const [searchParams]            = useSearchParams();
  const navigate                  = useNavigate();
  const token                     = searchParams.get('token');
  const [password, setPassword]   = useState('');
  const [confirm, setConfirm]     = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [error, setError]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [success, setSuccess]     = useState(false);

  const strength = (() => {
    let s = 0;
    if (password.length >= 8)         s++;
    if (/[A-Z]/.test(password))       s++;
    if (/[0-9]/.test(password))       s++;
    if (/[^A-Za-z0-9]/.test(password)) s++;
    return s;
  })();

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong'][strength];
  const strengthColor = ['', 'bg-danger', 'bg-warning', 'bg-brand-400', 'bg-success'][strength];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match');
      return;
    }
    if (strength < 2) {
      setError('Password is too weak');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await authApi.resetPassword({ token, newPassword: password });
      setSuccess(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Reset link is invalid or expired');
    } finally {
      setLoading(false);
    }
  };

  if (!token) return (
    <AuthLayout>
      <div className="text-center">
        <p className="text-sm text-danger mb-4">Invalid reset link.</p>
        <Link to="/forgot-password" className="text-sm text-brand-600 hover:underline">
          Request a new one
        </Link>
      </div>
    </AuthLayout>
  );

  if (success) return (
    <AuthLayout>
      <div className="flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-xl bg-success-light flex items-center justify-center mb-4">
          <span className="text-success text-xl">✓</span>
        </div>
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
          Password updated
        </h2>
        <p className="text-sm text-[var(--text-muted)] mb-6">
          Your password has been reset successfully.
        </p>
        <Button onClick={() => navigate('/login')} className="w-full">
          Sign in now
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </AuthLayout>
  );

  return (
    <AuthLayout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-1">
          Set new password
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Choose a strong password for your account
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Password with show/hide */}
        <div className="space-y-1.5">
          <label className="label">New password</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] w-4 h-4">
              <Lock className="w-4 h-4" />
            </span>
            <input
              type={showPw ? 'text' : 'password'}
              className="input pl-9 pr-9"
              placeholder="Min. 8 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              onClick={() => setShowPw(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {/* Strength indicator */}
          {password && (
            <div className="space-y-1">
              <div className="flex gap-1">
                {[1,2,3,4].map(i => (
                  <div key={i} className={cn(
                    'h-1 flex-1 rounded-full transition-all duration-200',
                    i <= strength ? strengthColor : 'bg-[var(--border)]'
                  )} />
                ))}
              </div>
              <p className="text-xs text-[var(--text-muted)]">
                Strength: <span className="font-medium">{strengthLabel}</span>
              </p>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <label className="label">Confirm password</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
              <Lock className="w-4 h-4" />
            </span>
            <input
              type="password"
              className={cn(
                'input pl-9',
                confirm && password !== confirm && 'border-danger focus:border-danger'
              )}
              placeholder="Repeat password"
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
            />
          </div>
          {confirm && password !== confirm && (
            <p className="text-xs text-danger">Passwords don't match</p>
          )}
        </div>

        {error && <ErrorBox message={error} />}

        <Button
          type="submit"
          loading={loading}
          className="w-full"
          disabled={!password || password !== confirm || strength < 2}
        >
          Update password
          <ArrowRight className="w-4 h-4" />
        </Button>
      </form>
    </AuthLayout>
  );
};