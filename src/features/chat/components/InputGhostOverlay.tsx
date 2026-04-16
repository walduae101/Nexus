import { memo } from 'react';

/**
 * Ghost text overlay — absolutely positioned inside the textarea's relative
 * parent. Renders the predicted continuation in muted italic text aligned
 * exactly where the textarea's cursor sits.
 *
 * Technique: an invisible clone of `input` reserves the exact space the real
 * textarea content occupies (same font, same padding, same wrapping). The
 * suggestion text renders immediately after, giving the "typing into ghost"
 * effect when the cursor is at the end of the input.
 *
 * `pointer-events-none` lets all mouse/touch events pass straight through to
 * the real textarea. `aria-hidden` + `select-none` keep screen readers and
 * clipboard operations focused on the real content only.
 */
export const InputGhostOverlay = memo(function InputGhostOverlay({
  input,
  suggestion
}: {
  input: string;
  suggestion: string;
}) {
  if (!suggestion || suggestion.length === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="absolute inset-0 pointer-events-none py-2 text-start whitespace-pre-wrap break-words text-zinc-500/60 overflow-hidden select-none"
    >
      <span className="invisible">{input}</span>
      <span className="italic">{suggestion}</span>
    </div>
  );
});
