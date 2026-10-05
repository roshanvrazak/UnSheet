'use client';

import React from 'react';
import {
  Sparkles,
  Bot,
  Share2,
  PanelLeftClose,
  PanelLeft,
} from 'lucide-react';
import type { SheetModel } from '@unsheet/contracts';
import { ExportDropdown } from '@/components/export/ExportDropdown';
import { cn } from '@/lib/utils';

export interface FloatingCommandBarProps {
  onAskClick: () => void;
  onRefineClick: () => void;
  isRefineOpen: boolean;
  sheet: SheetModel;
  onShareClick: () => void;
  onToggleInspector: () => void;
  isInspectorOpen: boolean;
}

export function FloatingCommandBar({
  onAskClick,
  onRefineClick,
  isRefineOpen,
  sheet,
  onShareClick,
  onToggleInspector,
  isInspectorOpen,
}: FloatingCommandBarProps) {
  return (
    <div
      role="toolbar"
      aria-label="Studio quick actions toolbar"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 max-w-[95vw]"
    >
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 text-white border border-white/10 shadow-2xl backdrop-blur-xl">
        {/* Toggle Inspector Button */}
        <button
          type="button"
          onClick={onToggleInspector}
          aria-label="Toggle sheet inspector"
          title={isInspectorOpen ? 'Collapse inspector' : 'Expand inspector'}
          className={cn(
            'p-1.5 rounded-full transition-colors text-slate-300 hover:text-white hover:bg-white/10',
            isInspectorOpen && 'text-indigo-400 bg-white/10'
          )}
        >
          {isInspectorOpen ? (
            <PanelLeftClose className="w-4 h-4" />
          ) : (
            <PanelLeft className="w-4 h-4" />
          )}
        </button>

        <div className="h-4 w-px bg-white/15 mx-0.5" />

        {/* 1. Ask AI Trigger Pill */}
        <button
          type="button"
          onClick={onAskClick}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white text-xs font-semibold shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
        >
          <Bot className="w-3.5 h-3.5" />
          <span>Ask AI</span>
        </button>

        {/* 2. Refine Dashboard Trigger */}
        <button
          type="button"
          onClick={onRefineClick}
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors hover:bg-white/10 text-slate-200 hover:text-white',
            isRefineOpen && 'text-indigo-400 bg-white/10'
          )}
        >
          <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
          <span>Refine</span>
        </button>

        {/* 3. Export Dropdown */}
        <ExportDropdown sheet={sheet} />

        {/* 4. Share Trigger */}
        <button
          type="button"
          onClick={onShareClick}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium transition-colors hover:bg-white/10 text-slate-200 hover:text-white"
        >
          <Share2 className="w-3.5 h-3.5 text-slate-400" />
          <span>Share</span>
        </button>
      </div>
    </div>
  );
}
