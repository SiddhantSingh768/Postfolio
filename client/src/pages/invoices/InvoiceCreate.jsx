import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, FileText, Calendar, AlignLeft, User } from 'lucide-react';
import { PageWrapper }      from '../../components/layout/PageWrapper';
import { Card, CardHeader } from '../../components/ui/Card';
import { Button }           from '../../components/ui/Button';
import { Input }            from '../../components/ui/Input';
import { Textarea }         from '../../components/ui/Textarea';
import { Select }           from '../../components/ui/Select';
import { LineItemsEditor }  from '../../components/shared/LineItemsEditor';
import { InvoiceSummary }   from '../../components/shared/InvoiceSummary';
import { useCreateInvoice } from '../../hooks/useInvoices';
import { useClientList }    from '../../hooks/useClients';
import { useProjectList }   from '../../hooks/useProjects';
import { useToast }         from '../../components/ui/Toast';
import { computeTotals, EMPTY_LINE_ITEM } from '../../utils/gst';
import { cn } from '../../utils/cn';

const defaultDueDate = () => {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString().split('T')[0];
};

export const InvoiceCreate = () => {
  const navigate     = useNavigate();
  const [params]     = useSearchParams();
  const toast        = useToast();

  const defaultClient  = params.get('client')  || '';
  const defaultProject = params.get('project') || '';

  const [form, setForm] = useState({
    clientId:  defaultClient,
    projectId: defaultProject,
    dueDate:   defaultDueDate(),
    notes:     '',
  });

  const [lineItems, setLineItems] = useState([
    { ...EMPTY_LINE_ITEM, id: 1 }
  ]);

  const [errors, setErrors]     = useState({});
  const [lineErrors, setLineErrors] = useState([]);

  const createMutation = useCreateInvoice();

  const { data: clientsData } = useClientList({ limit: 100 });
  const clients = clientsData?.clients || [];

  const { data: projectsData } = useProjectList({
    client: form.clientId || undefined,
    limit:  100,
  });
  const projects = projectsData?.projects || [];

  useEffect(() => {
    if (form.clientId && form.projectId) {
      const projectBelongsToClient = projects.some(p =>
        p._id === form.projectId &&
        (p.client?._id === form.clientId || p.client === form.clientId)
      );
      if (!projectBelongsToClient) {
        setForm(f => ({ ...f, projectId: '' }));
      }
    }
  }, [form.clientId]);

  const { subtotal, totalGst, grandTotal } = useMemo(
    () => computeTotals(lineItems),
    [lineItems]
  );

  const set = (field) => (e) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const e = {};
    const le = lineItems.map(item => {
      const err = {};
      if (!item.description.trim()) err.description = 'Required';
      if (!item.qty || item.qty <= 0) err.qty = 'Must be > 0';
      if (!item.unitPrice && item.unitPrice !== 0) err.unitPrice = 'Required';
      return Object.keys(err).length ? err : null;
    });

    if (!form.clientId)      e.clientId  = 'Select a client';
    if (!form.dueDate)       e.dueDate   = 'Due date is required';
    if (le.some(Boolean))    e.lineItems = 'Fix line item errors';

    setErrors(e);
    setLineErrors(le);
    return Object.keys(e).length === 0 && !le.some(Boolean);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    try {
      const invoice = await createMutation.mutateAsync({
        clientId:  form.clientId,
        projectId: form.projectId || undefined,
        dueDate:   form.dueDate,
        notes:     form.notes.trim() || undefined,
        lineItems: lineItems.map(({ id, ...item }) => ({
          description: item.description,
          qty:         parseFloat(item.qty),
          unitPrice:   parseFloat(item.unitPrice),
          gstRate:     parseInt(item.gstRate),
        })),
      });
      toast.success(`Invoice created — ${invoice.invoiceNumber}`);
      navigate(`/invoices/${invoice._id}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to create invoice');
    }
  };

  return (
    <PageWrapper title="New invoice" subtitle="Create a professional invoice">
      <div className="max-w-4xl space-y-4 animate-fade-in">

        {/* Back */}
        <button
          onClick={() => navigate('/invoices')}
          className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to invoices
        </button>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Top section: client/project + dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader title="Bill to" subtitle="Who is this invoice for?" />

              <div className="space-y-3">
                <div>
                  <Select
                    label="Client *"
                    value={form.clientId}
                    onChange={set('clientId')}
                    error={errors.clientId}
                  >
                    <option value="">Select a client...</option>
                    {clients.map(c => (
                      <option key={c._id} value={c._id}>
                        {c.name}{c.company ? ` — ${c.company}` : ''}
                      </option>
                    ))}
                  </Select>

                  {form.clientId && (
                    <button
                      type="button"
                      onClick={() => navigate(`/clients/${form.clientId}`)}
                      className="text-xs text-brand-600 dark:text-brand-400 hover:underline mt-1 flex items-center gap-1"
                    >
                      <User className="w-3 h-3" />
                      View client details
                    </button>
                  )}
                </div>

                {/* Project dropdown — only shown when client is selected */}
                {form.clientId && (
                  <Select
                    label="Link to project (optional)"
                    value={form.projectId}
                    onChange={set('projectId')}
                  >
                    <option value="">No project</option>
                    {projects.map(p => (
                      <option key={p._id} value={p._id}>{p.title}</option>
                    ))}
                  </Select>
                )}
              </div>
            </Card>

            <Card>
              <CardHeader title="Invoice details" />
              <div className="space-y-3">
                <Input
                  label="Issue date"
                  type="date"
                  value={new Date().toISOString().split('T')[0]}
                  readOnly
                  icon={<Calendar className="w-4 h-4" />}
                  hint="Automatically set to today"
                />
                <Input
                  label="Due date *"
                  type="date"
                  value={form.dueDate}
                  onChange={set('dueDate')}
                  error={errors.dueDate}
                  icon={<Calendar className="w-4 h-4" />}
                />
              </div>
            </Card>
          </div>

          {/* Line items */}
          <Card>
            <CardHeader
              title="Line items"
              subtitle="Services or products being billed"
            />
            <LineItemsEditor
              items={lineItems}
              onChange={setLineItems}
              errors={lineErrors}
            />
            {errors.lineItems && (
              <p className="text-xs text-danger mt-2">{errors.lineItems}</p>
            )}
          </Card>

          {/* Summary + notes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader title="Notes" subtitle="Visible on the invoice" />
              <Textarea
                placeholder="Payment terms, bank details, or any other notes..."
                value={form.notes}
                onChange={set('notes')}
                hint="Optional"
              />
            </Card>

            <Card>
              <CardHeader title="Summary" />
              <InvoiceSummary
                subtotal={subtotal}
                totalGst={totalGst}
                grandTotal={grandTotal}
                lineItems={lineItems}
              />
            </Card>
          </div>

          {/* Actions */}
          <div className="flex gap-3 justify-end">
            <Button
              type="button"
              variant="secondary"
              onClick={() => navigate('/invoices')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              loading={createMutation.isPending}
              icon={<FileText className="w-4 h-4" />}
            >
              Create invoice
            </Button>
          </div>
        </form>
      </div>
    </PageWrapper>
  );
};