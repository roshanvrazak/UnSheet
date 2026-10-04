'use client';

import React, { useEffect } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service / console
    console.error('Dashboard Error Boundary caught error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div
        role="alert"
        aria-live="assertive"
        className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center"
      >
        <div className="h-14 w-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-inner">
          <AlertTriangle className="h-7 w-7" aria-hidden="true" />
        </div>

        <h2 className="text-xl font-bold text-slate-900 mb-2">
          Something went wrong
        </h2>

        <p className="text-sm text-slate-600 mb-6 leading-relaxed">
          {error?.message || 'An unexpected error occurred while rendering this view.'}
        </p>

        {error?.digest && (
          <div className="mb-6 p-3 bg-slate-100 rounded-lg text-xs font-mono text-slate-500 break-all text-left">
            Digest: {error.digest}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-md shadow-blue-500/20 transition-all text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Try Again
          </button>

          <button
            onClick={() => window.location.reload()}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 font-medium rounded-xl border border-slate-300 transition-all text-sm focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2"
          >
            <Home className="h-4 w-4" aria-hidden="true" />
            Reload Page
          </button>
        </div>
      </div>
    </div>
  );
}
