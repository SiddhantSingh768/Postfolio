import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate }    from 'react-router-dom';
import { Mail, ArrowRight, RotateCcw } from 'lucide-react';
import { authApi }    from '../../api/endpoints/auth.api';
import { Button }     from '../../components/ui/Button';
import { AuthLayout } from './AuthLayout';
import { ErrorBox }   from './ErrorBox';

export const VerifyEmail = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const email    = location.state?.email || '';

  const [otp, setOtp]         = useState(['', '', '', '', '', '']);
  const [error, setError]     = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent]   = useState(false);
  const inputRefs = useRef([]);

  useEffect(() => { inputRefs.current[0]?.focus(); }, []);

  const handleChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];

    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 6).split('');
      digits.forEach((d, i) => { if (i < 6) newOtp[i] = d; });
      setOtp(newOtp);
      inputRefs.current[Math.min(digits.length, 5)]?.focus();
      return;
    }

    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    const code = otp.join('');
    if (code.length !== 6) {
      setError('Please enter all 6 digits');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await authApi.verifyEmail({ email, otp: code });
      navigate('/login', {
        state: { verified: true, message: 'Email verified! You can now sign in.' }
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired code');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    try {
      await authApi.register({ email, resend: true });
    } catch {
    } finally {
      setResending(false);
      setResent(true);
      setTimeout(() => setResent(false), 30000);
    }
  };

  useEffect(() => {
    if (otp.every(d => d !== '')) {
      handleSubmit();
    }
  }, [otp]);

if (!email) {
  return (
    <AuthLayout>
      <div className="text-center">
        <p className="text-sm text-[var(--text-muted)] mb-4">
          No email address found. Please start from login.
        </p>
        <Link to="/login" className="text-sm text-brand-600 hover:underline">
          Go to login
        </Link>
      </div>
    </AuthLayout>
  );
}

  return (
    <AuthLayout>
      <div className="flex flex-col items-center text-center mb-6">
        <div className="w-12 h-12 rounded-xl bg-brand-50 dark:bg-brand-900/30 flex items-center justify-center mb-4">
          <Mail className="w-6 h-6 text-brand-600 dark:text-brand-400" />
        </div>
        <h1 className="text-xl font-semibold text-[var(--text-primary)] mb-1">
          Check your email
        </h1>
        <p className="text-sm text-[var(--text-muted)]">
          We sent a 6-digit code to
        </p>
        <p className="text-sm font-medium text-[var(--text-primary)] mt-0.5">
          {email}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* OTP input grid */}
        <div className="flex gap-2 justify-center mb-4">
          {otp.map((digit, i) => (
            <input
              key={i}
              ref={el => inputRefs.current[i] = el}
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={digit}
              onChange={e => handleChange(i, e.target.value)}
              onKeyDown={e => handleKeyDown(i, e)}
              className={`
                w-11 h-12 text-center text-lg font-semibold rounded-md border
                bg-[var(--bg-secondary)] text-[var(--text-primary)]
                transition-all duration-150
                focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500
                ${digit ? 'border-brand-500 bg-brand-50/50 dark:bg-brand-900/20' : 'border-[var(--border)]'}
              `}
            />
          ))}
        </div>

        {error && <ErrorBox message={error} className="mb-4" />}

        <Button
          type="submit"
          loading={loading}
          className="w-full mb-3"
          disabled={otp.some(d => d === '')}
        >
          Verify email
          <ArrowRight className="w-4 h-4" />
        </Button>
      </form>

      <div className="text-center">
        <p className="text-xs text-[var(--text-muted)] mb-2">
          Didn't receive the code?
        </p>
        {resent ? (
          <p className="text-xs text-success font-medium">
            ✓ Code resent — check your inbox
          </p>
        ) : (
          <button
            onClick={handleResend}
            disabled={resending}
            className="text-xs text-brand-600 dark:text-brand-400 hover:underline font-medium flex items-center gap-1 mx-auto"
          >
            <RotateCcw className="w-3 h-3" />
            {resending ? 'Sending...' : 'Resend code'}
          </button>
        )}
      </div>
    </AuthLayout>
  );
};