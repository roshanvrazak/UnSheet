'use client';

import React from 'react';
import { Sparkles, ArrowUpRight, PanelLeft, LayoutDashboard, Share2 } from 'lucide-react';
import type { SheetModel } from '@unsheet/contracts';
import { ExportDropdown } from '@/components/export/ExportDropdown';

export interface FloatingCommandBarProps {
  onAskClick: () => void;
  onRefineClick: () => void;
  isRefineOpen: boolean;
  sheet: SheetModel;
  onShareClick: () => void;
  onToggleInspector: () => void;
  isInspectorOpen: boolean;
}

/** Contextual actions stay above the dashboard, never over the data. */
export function FloatingCommandBar({ onAskClick, onRefineClick, isRefineOpen, sheet, onShareClick, onToggleInspector, isInspectorOpen }: FloatingCommandBarProps) {
  return (
    <div className="workspace-toolbar" role="toolbar" aria-label="Studio quick actions toolbar">
      <div className="workspace-context">
        <button type="button" className="icon-action" aria-label="Toggle sheet inspector" aria-expanded={isInspectorOpen} onClick={onToggleInspector}><PanelLeft size={18} aria-hidden="true" /></button>
        <span className="toolbar-divider" />
        <LayoutDashboard size={16} aria-hidden="true" />
        <span>Overview</span>
        <span className="workspace-local"><span />Live from your spreadsheet</span>
      </div>
      <div className="workspace-tools">
        <button type="button" className="secondary-action" onClick={onRefineClick} aria-expanded={isRefineOpen}><Sparkles size={15} aria-hidden="true" />Refine</button>
        <ExportDropdown sheet={sheet} />
        <button type="button" className="icon-action toolbar-share" aria-label="Share dashboard snapshot" onClick={onShareClick}><Share2 size={16} aria-hidden="true" /><span className="sr-only">Share</span></button>
        <button type="button" className="primary-action" onClick={onAskClick}><Sparkles size={15} aria-hidden="true" /><span>Ask AI</span><ArrowUpRight size={15} aria-hidden="true" /></button>
      </div>
    </div>
  );
}
