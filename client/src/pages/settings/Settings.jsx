import { useState, useEffect } from 'react';
import { useNavigate }         from 'react-router-dom';
import {
  User, Mail, Phone, Hash, Building2,
  FileText, Bell, Shield, LogOut, Save
} from 'lucide-react';
import { PageWrapper }  from '../../components/layout/PageWrapper';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button }       from '../../components/ui/Button';
import { Input }        from '../../components/ui/Input';
import { useToast }     from '../../components/ui/Toast';
import { useAuth }      from '../../context/AuthContext';
import axiosClient      from '../../api/axiosClient';
import { cn }           from '../../utils/cn';

const TABS = [
  { id: 'profile',  label: 'Profile',  icon: User     },
  { id: 'invoice',  label: 'Invoice',  icon: FileText },
  { id: 'account',  label: 'Account',  icon: Shield   },
];

export const Settings = () => {
  const { user, setUser, logout } = useAuth();
  const toast    = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab]   = useState('profile');
  const [loading, setLoading]       = useState(false);

  // Profile form state
  const [profile, setProfile] = useState({
    name:    user?.name    || '',
    phone:   user?.profile?.phone   || '',
    address: user?.profile?.address || '',
    gstin:   user?.profile?.gstin   || '',
  });

  // Invoice settings
  const [invoiceSettings, setInvoiceSettings] = useState({
    prefix:         user?.invoiceSettings?.prefix        || 'INV',
    defaultDueDays: user?.invoiceSettings?.defaultDueDays || 30,
  });

  // Sync when user loads
  useEffect(() => {
    if (user) {
      setProfile({
        name:    user.name                || '',
        phone:   user.profile?.phone      || '',
        address: user.profile?.address   || '',
        gstin:   user.profile?.gstin      || '',
      });
      setInvoiceSettings({
        prefix:         user.invoiceSettings?.prefix        || 'INV',
        defaultDueDays: user.invoiceSettings?.defaultDueDays || 30,
      });
    }
  }, [user]);

  const handleSaveProfile = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.patch('/auth/profile', {
        name:    profile.name,
        profile: {
          phone:   profile.phone   || null,
          address: profile.address || null,
          gstin:   profile.gstin   || null,
        },
      });
      setUser(res.data.data.user);
      toast.success('Profile saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveInvoice = async () => {
    setLoading(true);
    try {
      const res = await axiosClient.patch('/auth/profile', {
        invoiceSettings: {
          prefix:         invoiceSettings.prefix        || 'INV',
          defaultDueDays: parseInt(invoiceSettings.defaultDueDays) || 30,
        },
      });
      setUser(res.data.data.user);
      toast.success('Invoice settings saved');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const setP = (field) => (e) =>
    setProfile(p => ({ ...p, [field]: e.target.value }));

  const setI = (field) => (e) =>
    setInvoiceSettings(s => ({ ...s, [field]: e.target.value }));

  return (
    <PageWrapper title="Settings" subtitle="Manage your account and preferences">
      <div className="max-w-2xl space-y-4 animate-fade-in">

        {/* Tab navigation */}
        <div className="flex gap-1 bg-[var(--bg-tertiary)] p-1 rounded-lg w-fit">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-[var(--bg-secondary)] text-[var(--text-primary)] shadow-xs'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              )}
            >
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Profile tab */}
        {activeTab === 'profile' && (
          <Card>
            <CardHeader
              title="Profile"
              subtitle="Your name and contact information appears on invoices"
            />

            {/* Avatar */}
            <div className="flex items-center gap-3 mb-5 pb-5 border-b border-[var(--border)]">
              <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center flex-shrink-0">
                <span className="text-lg font-semibold text-white">
                  {user?.name?.[0]?.toUpperCase() || 'U'}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--text-primary)]">{user?.name}</p>
                <p className="text-xs text-[var(--text-muted)]">{user?.email}</p>
                {user?.oauthProvider === 'google' && (
                  <span className="text-xs text-brand-600 dark:text-brand-400 mt-0.5 block">
                    Signed in with Google
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <Input
                label="Full name"
                value={profile.name}
                onChange={setP('name')}
                icon={<User className="w-4 h-4" />}
                placeholder="Your name"
              />

              <Input
                label="Email address"
                value={user?.email || ''}
                readOnly
                icon={<Mail className="w-4 h-4" />}
                hint="Email cannot be changed"
              />

              <Input
                label="Phone number"
                type="tel"
                value={profile.phone}
                onChange={setP('phone')}
                icon={<Phone className="w-4 h-4" />}
                placeholder="+91 98765 43210"
              />

              <Input
                label="GSTIN"
                value={profile.gstin}
                onChange={(e) => setProfile(p => ({
                  ...p, gstin: e.target.value.toUpperCase()
                }))}
                icon={<Hash className="w-4 h-4" />}
                placeholder="27AAPFU0939F1ZV"
                hint="Your GST number — printed on invoices"
              />

              <div className="space-y-1.5">
                <label className="label">Business address</label>
                <textarea
                  className="input resize-none"
                  rows={3}
                  value={profile.address}
                  onChange={setP('address')}
                  placeholder="Your business address..."
                />
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSaveProfile}
                  loading={loading}
                  icon={<Save className="w-4 h-4" />}
                >
                  Save profile
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Invoice tab */}
        {activeTab === 'invoice' && (
          <Card>
            <CardHeader
              title="Invoice settings"
              subtitle="Controls how your invoice numbers are generated"
            />

            <div className="space-y-4">
              {/* Preview */}
              <div className="bg-[var(--bg-tertiary)] rounded-lg px-4 py-3 flex items-center justify-between">
                <span className="text-xs text-[var(--text-muted)]">Preview</span>
                <span className="text-sm font-semibold font-mono text-[var(--text-primary)]">
                  {invoiceSettings.prefix || 'INV'}-0001
                </span>
              </div>

              <Input
                label="Invoice prefix"
                value={invoiceSettings.prefix}
                onChange={(e) => setInvoiceSettings(s => ({
                  ...s, prefix: e.target.value.toUpperCase()
                }))}
                placeholder="INV"
                hint="Letters only — appears before the invoice number"
                maxLength={6}
              />

              <Input
                label="Default due days"
                type="number"
                min="1"
                max="365"
                value={invoiceSettings.defaultDueDays}
                onChange={setI('defaultDueDays')}
                hint="How many days after issue date invoices are due"
              />

              <div className="flex justify-end pt-2">
                <Button
                  onClick={handleSaveInvoice}
                  loading={loading}
                  icon={<Save className="w-4 h-4" />}
                >
                  Save settings
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Account tab */}
        {activeTab === 'account' && (
          <div className="space-y-4">
            {/* Account info */}
            <Card>
              <CardHeader title="Account" subtitle="Your account details" />
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-[var(--border)]">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">Email</p>
                    <p className="text-xs text-[var(--text-muted)]">{user?.email}</p>
                  </div>
                  <span className="text-xs text-success font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-success" />
                    Verified
                  </span>
                </div>

                <div className="flex items-center justify-between py-2 border-b border-[var(--border)]">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">Plan</p>
                    <p className="text-xs text-[var(--text-muted)]">Solo workspace</p>
                  </div>
                  <span className="badge bg-brand-50 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400">
                    Free
                  </span>
                </div>

                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">Member since</p>
                    <p className="text-xs text-[var(--text-muted)]">
                      {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', {
                        month: 'long', year: 'numeric'
                      }) : '—'}
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            {/* Change password */}
            <Card>
              <CardHeader
                title="Password"
                subtitle="Change your account password"
              />
              <Button
                variant="secondary"
                size="sm"
                onClick={() => navigate('/forgot-password')}
              >
                Reset password via email
              </Button>
            </Card>

            {/* Sign out */}
            <Card className="border-danger/20">
              <CardHeader
                title="Sign out"
                subtitle="Sign out from all devices"
              />
              <Button
                variant="danger"
                size="sm"
                onClick={handleLogout}
                icon={<LogOut className="w-4 h-4" />}
              >
                Sign out
              </Button>
            </Card>
          </div>
        )}
      </div>
    </PageWrapper>
  );
};