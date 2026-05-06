import { useState }   from 'react';
import { Link }       from 'react-router-dom';
import { Mail, ArrowLeft, ArrowRight } from 'lucide-react';
import { authApi }    from '../../api/endpoints/auth.api';
import { Input }      from '../../components/ui/Input';
import { Button }     from '../../components/ui/Button';
import { AuthLayout } from './AuthLayout';
import { ErrorBox }   from './ErrorBox';

export const ForgotPassword = () => {
  const [email, setEmail]   = useState('');
  const [sent, setSent]     = useState(false);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
      setSent(true);
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  if (sent) return (
    <AuthLayout>
      <div className="flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-xl bg-success-light flex items-center justify-center mb-4">
          <Mail className="w-6 h-6 text-success" />
        </div>
        <h2 className="text-xl font-semibold text-[var(--text-primary)] mb-2">
          Check your inbox
        </h2>
        <p className="text-sm text-[var(--text-muted)] mb-6 max-w-xs">
          If <strong>{email}</strong> is registered, you'll receive a password reset link shortly.
        </p>
        <Link
          to="/login"
          className="text-sm text-brand-600 dark:text-brand-400 hover:underline font-medium flex items-center gap-1"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to sign in
        </Link>
      </div>
    </AuthLayout>
  );

  return (
    <AuthLayout>
      <div className="mb-6">
        <Link
          to="/login"
          className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] mb-4 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" />
          Back to sign in
        </Link>
        <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-1">
          Reset password
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          Enter your email and we'll send you a reset link
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email address"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          icon={<Mail className="w-4 h-4" />}
          required
        />

        {error && <ErrorBox message={error} />}

        <Button type="submit" loading={loading} className="w-full">
          Send reset link
          <ArrowRight className="w-4 h-4" />
        </Button>
      </form>
    </AuthLayout>
  );
};