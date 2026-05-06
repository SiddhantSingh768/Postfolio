import { cn }     from '../../utils/cn';
import { Button } from '../ui/Button';

// Valid transitions per status — mirrors the backend state machine
const TRANSITIONS = {
  draft:     [{ to: 'active',    label: 'Start project',   variant: 'primary'   }],
  active:    [
    { to: 'on_hold',   label: 'Put on hold',     variant: 'secondary' },
    { to: 'completed', label: 'Mark complete',    variant: 'primary'   },
  ],
  on_hold:   [
    { to: 'active',    label: 'Resume',           variant: 'primary'   },
    { to: 'cancelled', label: 'Cancel project',   variant: 'danger'    },
  ],
  completed: [],
  cancelled: [],
};

export const StatusTransition = ({ project, onTransition, loading }) => {
  const actions = TRANSITIONS[project?.status] || [];
  if (!actions.length) return null;

  return (
    <div className="flex items-center gap-2">
      {actions.map(action => (
        <Button
          key={action.to}
          variant={action.variant}
          size="sm"
          loading={loading === action.to}
          disabled={!!loading}
          onClick={() => onTransition(action.to)}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
};