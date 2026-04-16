import { useEffect, useState, lazy, Suspense, useDeferredValue } from 'react';
import { BookText, X, Workflow, Gauge, TrendingDown } from 'lucide-react';
import type { KnowledgeGraph } from './KnowledgeFlowMap';

type TokenEconomy = {
  totalSaved?: number;
  totalIn?: number;
  totalOut?: number;
  lastTurnIn?: number;
  lastTurnOut?: number;
};

// Flow map loads on-demand only when the user switches to the graph view.
const KnowledgeFlowMap = lazy(() =>
  import('./KnowledgeFlowMap').then(m => ({ default: m.KnowledgeFlowMap }))
);

/**
 * Executive Summary Sidebar — retractable right-edge panel surfacing the
 * session's `longTermMemory` field. Pure native DOM + Tailwind utilities:
 * a fixed backdrop for click-outside dismissal, a right-anchored <aside>
 * panel with `role="complementary"` for WAI-ARIA landmark semantics, and
 * a keyboard escape hatch.
 *
 * Lazy-loaded by NexusChat — this chunk only fetches on first open, and
 * IndexedDB persistent cache (Phase 9) makes subsequent reads instant.
 */
export function ExecutiveSummarySidebar({
  isOpen,
  onClose,
  summary,
  graph,
  updatedAt,
  isArabic,
  windowSize,
  onWindowSizeChange,
  tokenEconomy
}: {
  isOpen: boolean;
  onClose: () => void;
  summary: string;
  graph?: KnowledgeGraph | null;
  updatedAt?: Date | null;
  isArabic?: boolean;
  windowSize?: number;
  onWindowSizeChange?: (size: number) => void;
  tokenEconomy?: TokenEconomy | null;
}) {
  const [view, setView] = useState<'summary' | 'graph'>('summary');
  const deferredWindowSize = useDeferredValue(windowSize ?? 20);
  const deferredTokensSaved = useDeferredValue(tokenEconomy?.totalSaved ?? 0);
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const hasContent = !!(summary && summary.trim().length > 0);
  const ts = updatedAt
    ? new Intl.DateTimeFormat(isArabic ? 'ar' : 'en', {
        dateStyle: 'medium',
        timeStyle: 'short'
      }).format(updatedAt)
    : null;

  const edgeClass = isArabic
    ? 'left-0 border-e border-zinc-800'
    : 'right-0 border-s border-zinc-800';

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={isArabic ? 'الملخص التنفيذي' : 'Executive Summary'}>
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside
        role="complementary"
        aria-labelledby="exec-summary-heading"
        dir={isArabic ? 'rtl' : 'ltr'}
        className={`absolute top-0 ${edgeClass} bottom-0 w-full sm:w-[480px] bg-zinc-950 shadow-2xl overflow-y-auto custom-scrollbar`}
      >
        <header className="sticky top-0 bg-zinc-950/95 backdrop-blur-sm border-b border-zinc-800 px-4 py-3 flex items-center justify-between gap-3">
          <h2 id="exec-summary-heading" className="text-xs font-bold uppercase tracking-wider text-primary/90 flex items-center gap-2">
            <BookText className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{isArabic ? 'الملخص التنفيذي' : 'Executive Summary'}</span>
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={isArabic ? 'إغلاق' : 'Close'}
            className="text-zinc-500 hover:text-zinc-200 transition-colors p-1 rounded hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </header>

        {ts && (
          <div className="px-4 pt-3 text-[10px] uppercase tracking-wider text-zinc-500 font-mono">
            {isArabic ? 'آخر تحديث' : 'Updated'}: <span className="text-zinc-400">{ts}</span>
          </div>
        )}

        {/* Segmented control — toggle between the text summary and the knowledge flow map.
            Graph tab disables when no graph is available. */}
        <div className="px-4 pt-3" role="tablist" aria-label={isArabic ? 'عرض الملخص' : 'Summary view'}>
          <div className="inline-flex items-center gap-1 p-1 bg-zinc-900/80 border border-zinc-800 rounded-lg">
            <button
              type="button"
              role="tab"
              aria-selected={view === 'summary'}
              onClick={() => setView('summary')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
                view === 'summary'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm ring-1 ring-zinc-700/50'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <BookText className="w-3 h-3" aria-hidden="true" />
              {isArabic ? 'الملخص' : 'Summary'}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={view === 'graph'}
              onClick={() => setView('graph')}
              disabled={!graph || !graph.nodes || graph.nodes.length === 0}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-40 disabled:cursor-not-allowed ${
                view === 'graph'
                  ? 'bg-zinc-800 text-zinc-100 shadow-sm ring-1 ring-zinc-700/50'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Workflow className="w-3 h-3" aria-hidden="true" />
              {isArabic ? 'مخطط التدفق' : 'Flow Map'}
            </button>
          </div>
        </div>

        {/* Phase-20 control bay: per-session context window + token economy telemetry.
            Deferred values keep high-frequency slider events from blocking parent renders. */}
        <div className="px-4 pt-4 pb-2 space-y-3 border-b border-zinc-800/60">
          {onWindowSizeChange && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="exec-window-slider"
                  className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-zinc-500 font-semibold"
                >
                  <Gauge className="w-3 h-3" aria-hidden="true" />
                  {isArabic ? 'حجم نافذة السياق' : 'Context Window Size'}
                </label>
                <span className="text-[11px] font-mono tabular-nums text-zinc-300">
                  {deferredWindowSize} {isArabic ? 'دور' : 'turns'}
                </span>
              </div>
              <input
                id="exec-window-slider"
                type="range"
                min={5}
                max={50}
                step={1}
                value={deferredWindowSize}
                onChange={(e) => onWindowSizeChange(parseInt(e.target.value, 10))}
                aria-label={isArabic ? 'حجم نافذة السياق' : 'Context window size'}
                className="w-full h-1 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              />
              <p className="text-[10px] text-zinc-500 mt-1">
                {isArabic
                  ? 'عدد الرسائل الأخيرة المرسلة في كل طلب — الأقدم يُحفظ في الأرشيف.'
                  : 'Recent turns sent per request — older turns live in the archive.'}
              </p>
            </div>
          )}
          {deferredTokensSaved > 0 && (
            <div className="flex items-center gap-2 pt-2">
              <TrendingDown className="w-3.5 h-3.5 text-primary/80 shrink-0" aria-hidden="true" />
              <span className="text-[11px] text-zinc-400">
                {isArabic ? 'رموز موفّرة عبر النافذة المنزلقة' : 'Tokens saved via sliding window'}
              </span>
              <span className="ms-auto text-sm font-bold font-mono tabular-nums text-primary">
                {deferredTokensSaved.toLocaleString(isArabic ? 'ar' : 'en')}
              </span>
            </div>
          )}
          {tokenEconomy && (tokenEconomy.totalIn || tokenEconomy.totalOut) && (
            <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-zinc-500 font-mono">
              <span>{isArabic ? 'المدخل' : 'In'}: <span className="text-zinc-400 normal-case">{(tokenEconomy.totalIn || 0).toLocaleString()}</span></span>
              <span>{isArabic ? 'المخرج' : 'Out'}: <span className="text-zinc-400 normal-case">{(tokenEconomy.totalOut || 0).toLocaleString()}</span></span>
            </div>
          )}
        </div>

        {view === 'summary' && (
          <div className="px-4 py-4 text-[13px] text-zinc-300 leading-relaxed whitespace-pre-wrap break-words">
            {hasContent ? summary : (
              <div className="text-center py-10 text-zinc-500 italic text-sm">
                {isArabic
                  ? 'لم يتم توليد ملخص تنفيذي بعد. سيتم إنشاؤه تلقائياً عند تجاوز المحادثة حد 5000 حرف.'
                  : 'No executive summary yet. One will be generated automatically once this conversation exceeds 5,000 characters.'}
              </div>
            )}
          </div>
        )}

        {view === 'graph' && (
          <Suspense fallback={<div className="px-4 py-10 text-center text-zinc-500 text-sm">{isArabic ? 'جارٍ التحميل...' : 'Loading...'}</div>}>
            <KnowledgeFlowMap graph={graph || null} isArabic={isArabic} />
          </Suspense>
        )}
      </aside>
    </div>
  );
}
