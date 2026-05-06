import { useState }    from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Lock, ArrowRight } from 'lucide-react';
import { authApi }     from '../../api/endpoints/auth.api';
import { Input }       from '../../components/ui/Input';
import { Button }      from '../../components/ui/Button';
import { AuthLayout }  from './AuthLayout';
import { ErrorBox }    from './ErrorBox';

export const Register = () => {
  const navigate = useNavigate();
  const [form, setForm]     = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading]   = useState(false);

  const validate = () => {
    const e = {};
    if (!form.name.trim())       e.name     = 'Name is required';
    if (!form.email.includes('@')) e.email   = 'Valid email required';
    if (form.password.length < 8)  e.password = 'Minimum 8 characters';
    if (!/[A-Z]/.test(form.password)) e.password = 'Must contain an uppercase letter';
    if (!/[0-9]/.test(form.password)) e.password = 'Must contain a number';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setApiError('');
    setLoading(true);
    try {
      await authApi.register(form);
      navigate('/verify-email', { state: { email: form.email } });
    } catch (err) {
      setApiError(err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-1">
          Create account
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Start managing your freelance work
        </p>
      </div>

      {/* Google OAuth */}
      <button
        onClick={() => authApi.googleLogin()}
        className="w-full flex items-center justify-center gap-2.5 h-9 px-4 border border-[var(--border)] rounded-md text-sm font-medium text-[var(--text-primary)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] transition-colors duration-150 mb-4"
      >
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        Sign up with Google
      </button>

      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 h-px bg-[var(--border)]" />
        <span className="text-xs text-[var(--text-muted)]">or</span>
        <div className="flex-1 h-px bg-[var(--border)]" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Full name" type="text" placeholder="Siddhant Singh"
          value={form.name}
          onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
          icon={<User className="w-4 h-4" />}
          error={errors.name} required />
        <Input label="Email" type="email" placeholder="you@example.com"
          value={form.email}
          onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
          icon={<Mail className="w-4 h-4" />}
          error={errors.email} required />
        <Input label="Password" type="password" placeholder="Min. 8 characters"
          value={form.password}
          onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
          icon={<Lock className="w-4 h-4" />}
          error={errors.password}
          hint={!errors.password ? 'Uppercase, lowercase, and a number required' : undefined}
          required />

        {apiError && <ErrorBox message={apiError} />}

        <Button type="submit" loading={loading} className="w-full">
          Create account
          <ArrowRight className="w-4 h-4" />
        </Button>
      </form>

      <p className="text-center text-xs text-[var(--text-muted)] mt-6">
        Already have an account?{' '}
        <Link to="/login" className="text-brand-600 dark:text-brand-400 hover:underline font-medium">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
};