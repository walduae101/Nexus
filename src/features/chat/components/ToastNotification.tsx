import { memo, useEffect } from 'react';
import { CheckCircle2, X } from 'lucide-react';

export type ToastItem = {
  id: string;
  title: string;
  description?: string;
};

/**
 * ToastStack — transient notification overlay. Native <div> stacking at the
 * screen edge, `pointer-events-none` on the container so clicks pass through
 * the gap, `pointer-events-auto` on each toast card so dismiss/hover work.
 * Memoized so NexusChat's streaming re-renders don't force a repaint when
 * the toast list is unchanged.
 */
export const ToastStack = memo(function ToastStack({
  toasts,
  onDismiss,
  isArabic
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  isArabic?: boolean;
}) {
  if (toasts.length === 0) return null;

  const edgeClass = isArabic ? 'start-4' : 'end-4';

  return (
    <div
      className={`fixed bottom-4 ${edgeClass} z-[60] flex flex-col gap-2 max-w-sm pointer-events-none`}
      aria-live="polite"
      aria-relevant="additions"
    >
      {toasts.map(t => (
        <ToastCard
          key={t.id}
          toast={t}
          onDismiss={() => onDismiss(t.id)}
          isArabic={isArabic}
        />
      ))}
    </div>
  );
});

function ToastCard({
  toast,
  onDismiss,
  isArabic
}: {
  toast: ToastItem;
  onDismiss: () => void;
  isArabic?: boolean;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 5000);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      role="status"
      dir={isArabic ? 'rtl' : 'ltr'}
      className="pointer-events-auto bg-zinc-900/95 backdrop-blur-sm border border-primary/40 rounded-lg shadow-2xl shadow-primary/10 p-3 flex items-start gap-3 animate-in slide-in-from-bottom-4 fade-in duration-300"
    >
      <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold text-zinc-100 leading-snug">{toast.title}</div>
        {toast.description && (
          <div className="text-[11px] text-zinc-400 mt-1 leading-relaxed line-clamp-3">{toast.description}</div>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={isArabic ? 'إغلاق' : 'Dismiss'}
        className="text-zinc-500 hover:text-zinc-200 shrink-0 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded"
      >
        <X className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
