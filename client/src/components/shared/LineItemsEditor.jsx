import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Button }   from '../ui/Button';
import { cn }       from '../../utils/cn';
import { formatINR, EMPTY_LINE_ITEM } from '../../utils/gst';

const GST_RATES = [0, 5, 12, 18, 28];

export const LineItemsEditor = ({ items, onChange, errors = [] }) => {

  const addItem = () =>
    onChange([...items, { ...EMPTY_LINE_ITEM, id: Date.now() }]);

  const removeItem = (index) =>
    onChange(items.filter((_, i) => i !== index));

  const updateItem = (index, field, value) => {
    const updated = items.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    );
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="hidden md:grid grid-cols-12 gap-2 px-2 pb-1">
        {[
          { label: 'Description',  span: 'col-span-5' },
          { label: 'Qty',          span: 'col-span-1' },
          { label: 'Unit price',   span: 'col-span-2' },
          { label: 'GST',          span: 'col-span-1' },
          { label: 'Amount',       span: 'col-span-2' },
          { label: '',             span: 'col-span-1' },
        ].map(h => (
          <span key={h.label} className={cn(
            'text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider',
            h.span
          )}>
            {h.label}
          </span>
        ))}
      </div>

      {/* Line item rows */}
      {items.map((item, index) => {
        const amount    = (parseFloat(item.qty) || 0) * (parseFloat(item.unitPrice) || 0);
        const withGst   = amount * (1 + (parseFloat(item.gstRate) || 0) / 100);
        const hasError  = errors[index];

        return (
          <div
            key={item.id || index}
            className={cn(
              'grid grid-cols-12 gap-2 p-2 rounded-lg',
              'bg-[var(--bg-tertiary)] border border-transparent',
              'transition-colors duration-100',
              hasError && 'border-danger/30'
            )}
          >
            {/* Description */}
            <div className="col-span-12 md:col-span-5">
              <input
                type="text"
                className="input text-sm"
                placeholder="Service description"
                value={item.description}
                onChange={e => updateItem(index, 'description', e.target.value)}
              />
              {hasError?.description && (
                <p className="text-xs text-danger mt-0.5">{hasError.description}</p>
              )}
            </div>

            {/* Qty */}
            <div className="col-span-4 md:col-span-1">
              <input
                type="number"
                className="input text-sm text-center"
                placeholder="1"
                min="0.01"
                step="0.01"
                value={item.qty}
                onChange={e => updateItem(index, 'qty', e.target.value)}
              />
            </div>

            {/* Unit price */}
            <div className="col-span-4 md:col-span-2 relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--text-muted)]">
                ₹
              </span>
              <input
                type="number"
                className="input text-sm pl-5"
                placeholder="0"
                min="0"
                step="0.01"
                value={item.unitPrice}
                onChange={e => updateItem(index, 'unitPrice', e.target.value)}
              />
            </div>

            {/* GST rate */}
            <div className="col-span-4 md:col-span-1">
              <select
                className="input text-sm appearance-none"
                value={item.gstRate}
                onChange={e => updateItem(index, 'gstRate', parseInt(e.target.value))}
              >
                {GST_RATES.map(r => (
                  <option key={r} value={r}>{r}%</option>
                ))}
              </select>
            </div>

            {/* Computed amount */}
            <div className="col-span-10 md:col-span-2 flex items-center justify-end">
              <span className="text-sm font-medium text-[var(--text-primary)] font-mono">
                {formatINR(withGst)}
              </span>
            </div>

            {/* Remove button */}
            <div className="col-span-2 md:col-span-1 flex items-center justify-center">
              <button
                type="button"
                onClick={() => removeItem(index)}
                disabled={items.length === 1}
                className="w-7 h-7 rounded-md flex items-center justify-center text-[var(--text-muted)] hover:bg-danger-light hover:text-danger transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        );
      })}

      {/* Add row button */}
      <button
        type="button"
        onClick={addItem}
        className="flex items-center gap-2 text-xs text-[var(--text-muted)] hover:text-brand-600 transition-colors py-1 px-2"
      >
        <Plus className="w-3.5 h-3.5" />
        Add line item
      </button>
    </div>
  );
};