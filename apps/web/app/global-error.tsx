'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global Error Boundary caught critical error:', error);
  }, [error]);

  return (
    <html lang="en">
      <body className="antialiased bg-slate-900 text-slate-100 min-h-screen flex items-center justify-center p-4">
        <div
          role="alert"
          aria-live="assertive"
          className="max-w-md w-full bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-8 text-center"
        >
          <div className="h-14 w-14 bg-red-950 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-5 border border-red-900/50">
            <AlertTriangle className="h-7 w-7" aria-hidden="true" />
          </div>

          <h2 className="text-xl font-bold text-white mb-2">
            Something went wrong
          </h2>

          <p className="text-sm text-slate-300 mb-6 leading-relaxed">
            {error?.message || 'A critical application error occurred.'}
          </p>

          {error?.digest && (
            <div className="mb-6 p-3 bg-slate-900/80 rounded-lg text-xs font-mono text-slate-400 break-all text-left border border-slate-700/50">
              Digest: {error.digest}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => reset()}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl shadow-lg shadow-blue-600/30 transition-all text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 focus:ring-offset-slate-800"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Try Again
            </button>

            <button
              onClick={() => window.location.reload()}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-xl border border-slate-600 transition-all text-sm focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 focus:ring-offset-slate-800"
            >
              Reload Page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
