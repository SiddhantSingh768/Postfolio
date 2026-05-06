import { useState, useEffect } from 'react';
import { CheckSquare, Calendar, AlignLeft } from 'lucide-react';
import { Drawer }   from '../ui/Drawer';
import { Input }    from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Button }   from '../ui/Button';
import { useAddMilestone, useUpdateMilestone } from '../../hooks/useProjects';
import { useToast } from '../ui/Toast';

const EMPTY = { title: '', description: '', dueDate: '' };

export const MilestoneDrawer = ({ open, onClose, projectId, milestone }) => {
  const isEdit = !!milestone;
  const toast  = useToast();

  const [form, setForm]   = useState(EMPTY);
  const [errors, setErrors] = useState({});

  const addMutation    = useAddMilestone(projectId);
  const updateMutation = useUpdateMilestone(projectId);
  const loading = addMutation.isPending || updateMutation.isPending;

  useEffect(() => {
    if (milestone) {
      setForm({
        title:       milestone.title       || '',
        description: milestone.description || '',
        dueDate:     milestone.dueDate ? milestone.dueDate.split('T')[0] : '',
      });
    } else {
      setForm(EMPTY);
    }
    setErrors({});
  }, [milestone, open]);

  const set = (field) => (e) =>
    setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      setErrors({ title: 'Title is required' });
      return;
    }

    const data = {
      title:       form.title.trim(),
      description: form.description.trim() || null,
      dueDate:     form.dueDate || null,
    };

    try {
      if (isEdit) {
        await updateMutation.mutateAsync({ id: milestone._id, data });
        toast.success('Milestone updated');
      } else {
        await addMutation.mutateAsync(data);
        toast.success('Milestone added');
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
      title={isEdit ? 'Edit milestone' : 'Add milestone'}
      subtitle="Tracked work unit within this project"
    >
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <Input
          label="Milestone title *"
          placeholder="Design mockups"
          value={form.title}
          onChange={set('title')}
          error={errors.title}
          icon={<CheckSquare className="w-4 h-4" />}
        />

        <Textarea
          label="Description"
          placeholder="What needs to be done for this milestone..."
          value={form.description}
          onChange={set('description')}
        />

        <Input
          label="Due date"
          type="date"
          value={form.dueDate}
          onChange={set('dueDate')}
          icon={<Calendar className="w-4 h-4" />}
        />

        <div className="flex gap-2 pt-2 border-t border-[var(--border)]">
          <Button type="button" variant="secondary" className="flex-1"
            onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" className="flex-1" loading={loading}>
            {isEdit ? 'Save changes' : 'Add milestone'}
          </Button>
        </div>
      </form>
    </Drawer>
  );
};