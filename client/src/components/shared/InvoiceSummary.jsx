import { formatINR, getGstBreakdown } from '../../utils/gst';

export const InvoiceSummary = ({ subtotal, totalGst, grandTotal, lineItems = [] }) => {
  const breakdown = getGstBreakdown(lineItems);

  return (
    <div className="bg-[var(--bg-tertiary)] rounded-lg p-4 space-y-2">
      {/* Subtotal */}
      <div className="flex justify-between text-sm">
        <span className="text-[var(--text-secondary)]">Subtotal</span>
        <span className="font-mono text-[var(--text-primary)]">{formatINR(subtotal)}</span>
      </div>

      {/* GST breakdown per rate */}
      {Object.entries(breakdown).map(([rate, amount]) => (
        <div key={rate} className="flex justify-between text-sm">
          <span className="text-[var(--text-muted)]">GST @ {rate}</span>
          <span className="font-mono text-[var(--text-muted)]">{formatINR(amount)}</span>
        </div>
      ))}

      {/* Divider */}
      <div className="h-px bg-[var(--border)] my-1" />

      {/* Grand total */}
      <div className="flex justify-between">
        <span className="text-sm font-semibold text-[var(--text-primary)]">Total due</span>
        <span className="text-lg font-semibold text-brand-600 dark:text-brand-400 font-mono">
          {formatINR(grandTotal)}
        </span>
      </div>
    </div>
  );
};