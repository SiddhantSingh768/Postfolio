import { useState, useEffect } from 'react';
import { FolderOpen, AlignLeft, Calendar, DollarSign, Tag } from 'lucide-react';
import { Drawer }         from '../ui/Drawer';
import { Input }          from '../ui/Input';
import { Textarea }       from '../ui/Textarea';
import { Select }         from '../ui/Select';
import { Button }         from '../ui/Button';
import { useCreateProject, useUpdateProject } from '../../hooks/useProjects';
import { useClientList }  from '../../hooks/useClients';
import { useToast }       from '../ui/Toast';

const EMPTY_FORM = {
  clientId:    '',
  title:       '',
  description: '',
  startDate:   '',
  endDate:     '',
  budget:      '',
  tags:        '',
};

export const ProjectDrawer = ({ open, onClose, project, defaultClientId }) => {
  const isEdit = !!project;
  const toast  = useToast();

  const [form, setForm]   = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});

  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();
  const loading = createMutation.isPending || updateMutation.isPending;

  const { data: clientsData } = useClientList({ limit: 100 });
  const clients = clientsData?.clients || [];

  useEffect(() => {
    if (project) {
      setForm({
        clientId:    project.client?._id || project.client || '',
        title:       project.title       || '',
        description: project.description || '',
        startDate:   project.startDate   ? project.startDate.split('T')[0] : '',
        endDate:     project.endDate     ? project.endDate.split('T')[0]   : '',
        budget:      project.budget      ? String(project.budget) : '',
        tags:        project.tags?.join(', ') || '',
      });
    } else {
      setForm({ ...EMPTY_FORM, clientId: defaultClientId || '' });
    }
    setErrors({});
  }, [project, open, defaultClientId]);

  const set = (field) => (e) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.clientId) e.clientId = 'Select a client';
    if (!form.title.trim()) e.title = 'Title is required';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const data = {
      clientId:    form.clientId,
      title:       form.title.trim(),
      description: form.description.trim() || null,
      startDate:   form.startDate || null,
      endDate:     form.endDate   || null,
      budget:      form.budget ? parseFloat(form.budget) : null,
      tags:        form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    };

    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: project._id, data });
        toast.success('Project updated');
      } else {
        await createMutation.mutateAsync(data);
        toast.success('Project created');
      }
      onClose();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Something went wrong');
    }
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={isEdit ? 'Edit project' : 'New project'}
      subtitle={isEdit ? `Editing ${project?.title}` : 'Create a project linked to a client'}
    >
      <form onSubmit={handleSubmit} className="p-5 space-y-4">

        {/* Client selector */}
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

        <Input
          label="Project title *"
          placeholder="Website redesign"
          value={form.title}
          onChange={set('title')}
          error={errors.title}
          icon={<FolderOpen className="w-4 h-4" />}
        />

        <Textarea
          label="Description"
          placeholder="Brief description of the project scope..."
          value={form.description}
          onChange={set('description')}
        />

        {/* Date range */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Start date"
            type="date"
            value={form.startDate}
            onChange={set('startDate')}
            icon={<Calendar className="w-4 h-4" />}
          />
          <Input
            label="End date"
            type="date"
            value={form.endDate}
            onChange={set('endDate')}
            icon={<Calendar className="w-4 h-4" />}
          />
        </div>

        <Input
          label="Budget (₹)"
          type="number"
          placeholder="50000"
          min="0"
          value={form.budget}
          onChange={set('budget')}
          icon={<DollarSign className="w-4 h-4" />}
          hint="Optional project budget in INR"
        />

        <Input
          label="Tags"
          placeholder="web, design, react"
          value={form.tags}
          onChange={set('tags')}
          icon={<Tag className="w-4 h-4" />}
          hint="Comma separated tags"
        />

        <div className="flex gap-2 pt-2 border-t border-[var(--border)]">
          <Button type="button" variant="secondary" className="flex-1"
            onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" loading={loading}>
            {isEdit ? 'Save changes' : 'Create project'}
          </Button>
        </div>
      </form>
    </Drawer>
  );
};