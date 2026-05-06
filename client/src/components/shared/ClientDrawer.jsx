import { useState, useEffect } from 'react';
import { Building2, Mail, Phone, MapPin, FileText, Hash } from 'lucide-react';
import { Drawer }    from '../ui/Drawer';
import { Input }     from '../ui/Input';
import { Textarea }  from '../ui/Textarea';
import { Select }    from '../ui/Select';
import { Button }    from '../ui/Button';
import { useCreateClient, useUpdateClient } from '../../hooks/useClients';
import { useToast }  from '../ui/Toast';

const COUNTRIES = [
  { code: 'IN', name: 'India' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'AU', name: 'Australia' },
  { code: 'SG', name: 'Singapore' },
  { code: 'AE', name: 'UAE' },
];

const EMPTY_FORM = {
  name: '', company: '', email: '',
  phone: '', country: 'IN', gstin: '', notes: '',
};

export const ClientDrawer = ({ open, onClose, client }) => {
  const isEdit = !!client;
  const toast  = useToast();

  const [form, setForm]   = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  const createMutation = useCreateClient();
  const updateMutation = useUpdateClient();
  const loading = createMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (client) {
      setForm({
        name:    client.name    || '',
        company: client.company || '',
        email:   client.email   || '',
        phone:   client.phone   || '',
        country: client.country || 'IN',
        gstin:   client.gstin   || '',
        notes:   client.notes   || '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
    setErrors({});
  }, [client, open]);

  const set = (field) => (e) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.name.trim())              e.name  = 'Name is required';
    if (!form.email.includes('@'))      e.email = 'Valid email required';
    if (form.gstin && form.gstin.length !== 15)
      e.gstin = 'GSTIN must be 15 characters';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: client._id, data: form });
        toast.success('Client updated');
      } else {
        await createMutation.mutateAsync(form);
        toast.success('Client created');
      }
      onClose();
    } catch (err) {
      const msg = err.response?.data?.message || 'Something went wrong';
      toast.error(msg);
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit client' : 'New client'}
      subtitle={isEdit ? `Editing ${client?.name}` : 'Add a new client to your workspace'}
    >
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        {/* Basic info */}
        <div className="space-y-1 mb-2">
          <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
            Basic information
          </p>
        </div>

        <Input
          label="Full name *"
          placeholder="John Smith"
          value={form.name}
          onChange={set('name')}
          error={errors.name}
          icon={<FileText className="w-4 h-4" />}
        />

        <Input
          label="Company"
          placeholder="Acme Corp"
          value={form.company}
          onChange={set('company')}
          icon={<Building2 className="w-4 h-4" />}
        />

        <Input
          label="Email address *"
          type="email"
          placeholder="client@company.com"
          value={form.email}
          onChange={set('email')}
          error={errors.email}
          icon={<Mail className="w-4 h-4" />}
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Phone"
            type="tel"
            placeholder="+91 98765 43210"
            value={form.phone}
            onChange={set('phone')}
            icon={<Phone className="w-4 h-4" />}
          />
          <Select
            label="Country"
            value={form.country}
            onChange={set('country')}
          >
            {COUNTRIES.map(c => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </Select>
        </div>

        {/* Tax info */}
        <div className="pt-2 space-y-1 mb-2">
          <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
            Tax information
          </p>
        </div>

        <Input
          label="GSTIN"
          placeholder="27AAPFU0939F1ZV"
          value={form.gstin}
          onChange={(e) => setForm(f => ({ ...f, gstin: e.target.value.toUpperCase() }))}
          error={errors.gstin}
          hint="15-character GST Identification Number"
          icon={<Hash className="w-4 h-4" />}
        />

        {/* Notes */}
        <div className="pt-2 space-y-1 mb-2">
          <p className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">
            Additional notes
          </p>
        </div>

        <Textarea
          label="Notes"
          placeholder="Any relevant information about this client..."
          value={form.notes}
          onChange={set('notes')}
          hint="Max 1000 characters"
        />

        {/* Actions */}
        <div className="flex gap-2 pt-2 border-t border-[var(--border)] sticky bottom-0 bg-[var(--bg-secondary)] pb-1">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1"
            loading={loading}
          >
            {isEdit ? 'Save changes' : 'Create client'}
          </Button>
        </div>
      </form>
    </Drawer>
  );
};