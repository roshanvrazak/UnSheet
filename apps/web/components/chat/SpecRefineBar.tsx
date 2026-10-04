'use client';

import React, { useState } from 'react';
import { DashboardSpec, SheetProfile } from '@unsheet/contracts';
import { toLLMColumnProfile } from '@unsheet/engine';
import { Sparkles, Send, Loader2, AlertCircle, Undo2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface SpecRefineBarProps {
  currentSpec: DashboardSpec;
  profile: SheetProfile;
  onSpecUpdate: (newSpec: DashboardSpec) => void;
  className?: string;
}

export function SpecRefineBar({
  currentSpec,
  profile,
  onSpecUpdate,
  className,
}: SpecRefineBarProps) {
  const [prompt, setPrompt] = useState<string>('');
  const [isRefining, setIsRefining] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isRateLimit, setIsRateLimit] = useState<boolean>(false);
  const [successInfo, setSuccessInfo] = useState<{
    explanation: string;
    appliedChanges: string[];
    previousSpec: DashboardSpec;
  } | null>(null);

  const handleRefine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || isRefining) return;

    setIsRefining(true);
    setError(null);
    setIsRateLimit(false);

    try {
      const llmProfiles = profile.columnProfiles.map(toLLMColumnProfile);
      const res = await fetch('/api/spec/refine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          currentSpec,
          profiles: llmProfiles,
        }),
      });

      if (res.status === 429) {
        setIsRateLimit(true);
        setError('Rate limit exceeded (429). Please wait before trying again.');
        setIsRefining(false);
        return;
      }

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to refine dashboard spec.');
      }

      const prevSpec = JSON.parse(JSON.stringify(currentSpec));
      onSpecUpdate(data.updatedSpec);
      setSuccessInfo({
        explanation: data.explanation,
        appliedChanges: data.appliedChanges || [],
        previousSpec: prevSpec,
      });
      setPrompt('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Unknown error during refinement');
    } finally {
      setIsRefining(false);
    }
  };

  const handleUndo = () => {
    if (successInfo) {
      onSpecUpdate(successInfo.previousSpec);
      setSuccessInfo(null);
    }
  };

  return (
    <div className={cn('w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm space-y-3', className)}>
      <form onSubmit={handleRefine} className="flex items-center space-x-2">
        <div className="p-2 bg-indigo-100 dark:bg-indigo-950/60 rounded-lg text-indigo-600 dark:text-indigo-400 shrink-0">
          <Sparkles className="w-4 h-4" />
        </div>
        <Input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Refine dashboard with AI (e.g. 'Add a KPI for total revenue', 'Change bar chart to donut')..."
          disabled={isRefining}
          className="flex-1 bg-white dark:bg-slate-900 text-sm"
        />
        <Button
          type="submit"
          disabled={isRefining || !prompt.trim()}
          className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 text-xs font-medium"
        >
          {isRefining ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
              Refining...
            </>
          ) : (
            <>
              <Send className="w-3.5 h-3.5 mr-1.5" />
              Refine
            </>
          )}
        </Button>
      </form>

      {/* Error / Rate limit alert */}
      {error && (
        <div className={cn('p-3 rounded-lg flex items-center justify-between text-xs', isRateLimit ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-200 text-amber-800 dark:text-amber-300' : 'bg-red-50 dark:bg-red-950/30 border border-red-200 text-red-800 dark:text-red-300')}>
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setError(null)} className="h-auto p-1 text-xs">
            Dismiss
          </Button>
        </div>
      )}

      {/* Success banner with explanation, tags, and Undo button */}
      {successInfo && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div className="space-y-1">
            <div className="flex items-center space-x-1.5 text-emerald-800 dark:text-emerald-300 font-medium">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Dashboard successfully refined!</span>
            </div>
            <p className="text-emerald-700 dark:text-emerald-400">{successInfo.explanation}</p>
            {successInfo.appliedChanges.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {successInfo.appliedChanges.map((change, idx) => (
                  <span
                    key={idx}
                    className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded text-[10px] font-medium"
                  >
                    {change}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <Button
              size="sm"
              variant="outline"
              onClick={handleUndo}
              className="border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-xs h-7"
            >
              <Undo2 className="w-3 h-3 mr-1" />
              Undo
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSuccessInfo(null)}
              className="text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-xs h-7"
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
