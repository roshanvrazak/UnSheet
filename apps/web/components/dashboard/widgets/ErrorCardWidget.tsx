'use client';

import React from 'react';
import { AlertTriangle } from 'lucide-react';

export interface ErrorCardWidgetProps {
  title?: string | undefined;
  error?: Error | string | null | undefined;
  widgetId?: string | undefined;
}

/**
 * Total fallback error card for invalid, malformed, or failing widgets.
 * Never reveals raw stack traces, file paths, or untrusted code strings.
 * Conforms to strict accessibility guidelines (WCAG AA, role="alert").
 */
export function ErrorCardWidget({
  title = 'Widget Error',
  error,
  widgetId,
}: ErrorCardWidgetProps) {
  // Extract a sanitized, user-friendly error message
  const rawMessage =
    typeof error === 'string'
      ? error
      : error instanceof Error
      ? error.message
      : 'Failed to render widget component.';

  // Strip file paths, memory addresses, or stack trace artifacts for safety
  const safeMessage = rawMessage
    .replace(/(?:\/[a-zA-Z0-9_.-]+)+/g, '[path]')
    .slice(0, 200);

  return (
    <div
      role="alert"
      aria-live="polite"
      className="flex flex-col justify-between h-full min-h-[160px] rounded-xl border border-rose-200 bg-rose-50/60 p-5 text-slate-800 shadow-sm transition-all"
    >
      <div>
        <div className="flex items-center gap-2.5 text-rose-700">
          <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
          <h3 className="font-semibold text-sm tracking-tight text-rose-900">
            {title}
          </h3>
        </div>
        <p className="mt-2.5 text-xs text-rose-800/90 leading-relaxed">
          {safeMessage}
        </p>
      </div>

      <div className="mt-4 pt-3 border-t border-rose-200/60 flex items-center justify-between text-[11px] text-rose-700">
        <span>Display fallback active</span>
        {widgetId && (
          <span className="font-mono text-rose-600/80">ID: {widgetId}</span>
        )}
      </div>
    </div>
  );
}
