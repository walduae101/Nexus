import { useState } from 'react';
import { Sparkles, ChevronDown } from 'lucide-react';

/**
 * Distilled Memory Mirror — a collapsible contextual banner that surfaces the
 * current session's distilled situational summary (the `projectSummary` field
 * written by compressChatHistory) directly in the workspace.
 *
 * Built with native DOM elements (<section>, <button>, <div>) + Tailwind; full
 * WAI-ARIA compliance via `role="region"`, `aria-label`, `aria-expanded`, and
 * `aria-controls`. No headless UI libraries — zero extra vendor bytes in the
 * chunk this component ships in.
 */
export function DistilledMemoryMirror({
  summary,
  isArabic
}: {
  summary: string;
  isArabic?: boolean;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!summary || summary.trim().length === 0) return null;

  const labelId = 'distilled-memory-heading';
  const contentId = 'distilled-memory-content';

  return (
    <section
      role="region"
      aria-labelledby={labelId}
      className="mx-4 mt-3 mb-2 rounded-lg border border-primary/20 bg-primary/[0.04] backdrop-blur-sm"
      dir={isArabic ? 'rtl' : 'ltr'}
    >
      <button
        type="button"
        onClick={() => setIsExpanded(prev => !prev)}
        aria-expanded={isExpanded}
        aria-controls={contentId}
        className="w-full flex items-center gap-2 px-3 py-2 text-start hover:bg-primary/[0.08] transition-colors rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" aria-hidden="true" />
        <span id={labelId} className="flex-1 text-[11px] font-semibold uppercase tracking-wider text-primary/90">
          {isArabic ? 'ذاكرة الجلسة المقطرة' : 'Distilled Session Memory'}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-primary/70 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      <div
        id={contentId}
        role="region"
        aria-labelledby={labelId}
        hidden={!isExpanded}
        className="px-3 pb-3 pt-1 text-[13px] text-zinc-300 leading-relaxed whitespace-pre-wrap break-words border-t border-primary/10"
      >
        {summary}
      </div>
    </section>
  );
}
