import { memo, useEffect, useRef } from 'react';
import { CheckCircle2, Wand2, Archive, X, Undo2 } from 'lucide-react';

export type ToastType = 'resolution' | 'next_action' | 'context_shift';

export type ToastItem = {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  /**
   * Extra payload used by the Undo pipeline. Only populated on `resolution`
   * toasts — carries the ids the parent needs to revert the Firestore mutation.
   */
  resolutionContext?: {
    sessionId: string;
    issueId: string;
  };
};

/**
 * Style atlas — single source of truth for per-type visual treatment.
 * Avoids ad-hoc ternaries scattered through the render path.
 */
const TYPE_STYLE: Record<ToastType, {
  icon: typeof CheckCircle2;
  iconClass: string;
  borderClass: string;
  shadowClass: string;
  autoDismissMs: number;
}> = {
  resolution: {
    icon: CheckCircle2,
    iconClass: 'text-primary',
    borderClass: 'border-primary/40',
    shadowClass: 'shadow-primary/10',
    autoDismissMs: 6500
  },
  next_action: {
    icon: Wand2,
    iconClass: 'text-amber-400',
    borderClass: 'border-amber-500/30',
    shadowClass: 'shadow-amber-500/10',
    autoDismissMs: 3500
  },
  context_shift: {
    icon: Archive,
    iconClass: 'text-zinc-400',
    borderClass: 'border-zinc-700/60',
    shadowClass: 'shadow-zinc-500/5',
    autoDismissMs: 3000
  }
};

/**
 * ToastStack — unified transient-notification overlay. LIFO visual order via
 * `flex-col-reverse` so newest entries render at the top of the stack without
 * mutating the underlying array. Memoized to isolate from NexusChat's high-
 * frequency streaming re-renders.
 */
export const ToastStack = memo(function ToastStack({
  toasts,
  onDismiss,
  onAction,
  isArabic
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
  onAction?: (toast: ToastItem) => void;
  isArabic?: boolean;
}) {
  if (toasts.length === 0) return null;

  const edgeClass = isArabic ? 'start-4' : 'end-4';

  return (
    <div
      className={`fixed bottom-4 ${edgeClass} z-[60] flex flex-col-reverse gap-2 max-w-sm pointer-events-none`}
      aria-live="polite"
      aria-relevant="additions"
    >
      {toasts.map(t => (
        <ToastCard
          key={t.id}
          toast={t}
          onDismiss={() => onDismiss(t.id)}
          onAction={onAction ? () => onAction(t) : undefined}
          isArabic={isArabic}
        />
      ))}
    </div>
  );
});

function ToastCard({
  toast,
  onDismiss,
  onAction,
  isArabic
}: {
  toast: ToastItem;
  onDismiss: () => void;
  onAction?: () => void;
  isArabic?: boolean;
}) {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    timerRef.current = window.setTimeout(onDismiss, TYPE_STYLE[toast.type].autoDismissMs);
    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, [onDismiss, toast.type]);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const handleUndo = () => {
    clearTimer();
    onAction?.();
    onDismiss();
  };

  const style = TYPE_STYLE[toast.type];
  const Icon = style.icon;
  const showUndo = toast.type === 'resolution' && !!toast.resolutionContext && !!onAction;

  return (
    <div
      role="status"
      dir={isArabic ? 'rtl' : 'ltr'}
      className={`pointer-events-auto bg-zinc-900/95 backdrop-blur-sm border rounded-lg shadow-2xl p-3 flex items-start gap-3 animate-in slide-in-from-bottom-4 fade-in duration-300 ${style.borderClass} ${style.shadowClass}`}
    >
      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${style.iconClass}`} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <div className="text-[12px] font-semibold text-zinc-100 leading-snug">{toast.title}</div>
        {toast.description && (
          <div className="text-[11px] text-zinc-400 mt-1 leading-relaxed line-clamp-3">{toast.description}</div>
        )}
        {showUndo && (
          <button
            type="button"
            onClick={handleUndo}
            className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary hover:text-primary/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded px-1 py-0.5 -mx-1"
          >
            <Undo2 className="w-3 h-3" aria-hidden="true" />
            {isArabic ? 'تراجع' : 'Undo'}
          </button>
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
