import { memo } from 'react';
import { Wand2 } from 'lucide-react';

/**
 * NextActionPill — proactive suggestion pill rendered above the chat input.
 * Native <button> with Tailwind utilities, full keyboard focus semantics,
 * and ARIA labeling. Wrapped in React.memo so NexusChat's high-frequency
 * keystroke re-renders don't force this subtree to repaint when the
 * suggestion text hasn't changed.
 */
export const NextActionPill = memo(function NextActionPill({
  suggestion,
  onClick,
  isArabic
}: {
  suggestion: string;
  onClick: () => void;
  isArabic?: boolean;
}) {
  if (!suggestion || suggestion.trim().length === 0) return null;

  return (
    <div className="mb-2 ms-1" dir={isArabic ? 'rtl' : 'ltr'}>
      <button
        type="button"
        onClick={onClick}
        aria-label={`${isArabic ? 'الإجراء التالي المقترح' : 'Suggested next action'}: ${suggestion}`}
        className="group inline-flex items-center gap-2 max-w-full text-[11px] font-medium text-primary/80 hover:text-primary bg-primary/[0.06] hover:bg-primary/[0.12] border border-primary/20 hover:border-primary/40 rounded-full px-3 py-1.5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <Wand2 className="w-3 h-3 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
        <span className="text-[10px] uppercase tracking-wider font-bold text-primary/60 shrink-0">
          {isArabic ? 'التالي' : 'Next'}
        </span>
        <span className="truncate text-start">{suggestion}</span>
      </button>
    </div>
  );
});
