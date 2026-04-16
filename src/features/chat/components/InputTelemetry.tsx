import { memo, useDeferredValue } from 'react';
import { Loader2, Zap } from 'lucide-react';

// Must match MAX_FIRESTORE_CHARS used by sendMessage — single source of truth.
export const MAX_INPUT_CHARS = 90000;
const AMBER_THRESHOLD = 0.8;  // 72,000 characters
const RED_THRESHOLD = 0.95;   // 85,500 characters
const VISIBILITY_THRESHOLD = 0.5; // 45,000 — below this the ring stays unmounted

/**
 * InputTelemetry — a deterministic progress ring rendered from native SVG
 * elements styled via Tailwind utility classes. Subscribes via `useDeferredValue`
 * so high-frequency keystroke mutations don't block higher-priority renders.
 * Wrapped in React.memo so the parent's re-renders don't cascade when `length`
 * has not changed.
 */
export const InputTelemetry = memo(function InputTelemetry({ length }: { length: number }) {
  const deferredLength = useDeferredValue(length);
  const ratio = deferredLength / MAX_INPUT_CHARS;
  const clamped = Math.min(1, Math.max(0, ratio));
  const percentage = Math.round(clamped * 100);

  if (ratio < VISIBILITY_THRESHOLD) return null;

  const color = ratio >= RED_THRESHOLD ? 'red' : ratio >= AMBER_THRESHOLD ? 'amber' : 'primary';
  const textClass =
    color === 'red' ? 'text-red-500' :
    color === 'amber' ? 'text-amber-400' :
    'text-primary/70';
  const strokeClass =
    color === 'red' ? 'stroke-red-500' :
    color === 'amber' ? 'stroke-amber-400' :
    'stroke-primary/70';

  const radius = 7;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - clamped);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Input length: ${deferredLength.toLocaleString()} of ${MAX_INPUT_CHARS.toLocaleString()} characters, ${percentage}% of limit`}
      className={`inline-flex items-center gap-1.5 text-[10px] font-mono tabular-nums transition-colors ${textClass}`}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <circle cx="9" cy="9" r={radius} className="stroke-zinc-800" strokeWidth="2" fill="transparent" />
        <circle
          cx="9" cy="9" r={radius}
          className={strokeClass}
          strokeWidth="2"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transform: 'rotate(-90deg)', transformOrigin: '9px 9px', transition: 'stroke-dashoffset 120ms linear' }}
        />
      </svg>
      <span>{Math.round(deferredLength / 1000)}k / 90k</span>
    </div>
  );
});

/**
 * CompressPayloadButton — only mounts into the DOM when the input crosses the
 * 80% warning threshold. Delegates the compression action via `onClick`.
 */
export const CompressPayloadButton = memo(function CompressPayloadButton({
  length,
  onClick,
  isCompressing,
  isArabic
}: {
  length: number;
  onClick: () => void;
  isCompressing: boolean;
  isArabic?: boolean;
}) {
  if (length / MAX_INPUT_CHARS < AMBER_THRESHOLD) return null;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isCompressing}
      aria-label={isArabic ? 'ضغط المحتوى بالذكاء الاصطناعي' : 'Compress payload with AI'}
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-amber-400 hover:text-amber-300 bg-amber-950/30 hover:bg-amber-900/40 border border-amber-900/50 hover:border-amber-800 rounded-lg px-2.5 py-1 transition-all disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
    >
      {isCompressing ? <Loader2 className="w-3 h-3 animate-spin" aria-hidden="true" /> : <Zap className="w-3 h-3" aria-hidden="true" />}
      <span>
        {isCompressing
          ? (isArabic ? 'جارٍ الضغط...' : 'Compressing...')
          : (isArabic ? 'ضغط المحتوى' : 'Compress')}
      </span>
    </button>
  );
});
