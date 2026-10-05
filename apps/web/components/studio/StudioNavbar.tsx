'use client';

import React from 'react';
import {
  FileSpreadsheet,
  ShieldCheck,
  UploadCloud,
  Share2,
  PanelLeftClose,
  PanelLeft,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { type SampleWorkbookMeta } from '@/lib/sample-workbooks';

export interface StudioNavbarProps {
  workbookName?: string | undefined;
  activeSheetName?: string | undefined;
  rowCount?: number | undefined;
  colCount?: number | undefined;
  onUploadClick: () => void;
  onShareClick: () => void;
  isInspectorOpen: boolean;
  onToggleInspector: () => void;
  activeSampleId?: string | undefined;
  onSelectSample?: ((sample: SampleWorkbookMeta) => void) | undefined;
}

export function StudioNavbar({
  workbookName,
  activeSheetName,
  rowCount,
  colCount,
  onUploadClick,
  onShareClick,
  isInspectorOpen,
  onToggleInspector,
}: StudioNavbarProps) {
  return (
    <header className="sticky top-0 z-40 h-14 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md transition-colors">
      <div className="h-full px-4 sm:px-6 flex items-center justify-between gap-4">
        {/* Left: Brand + Breadcrumbs */}
        <div className="flex items-center gap-3 min-w-0">
          {/* Inspector Toggle Button (visible when a workbook is loaded) */}
          {workbookName && (
            <button
              type="button"
              onClick={onToggleInspector}
              aria-label="Toggle sheet and field inspector"
              title={isInspectorOpen ? 'Collapse inspector' : 'Expand inspector'}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0"
            >
              {isInspectorOpen ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeft className="w-4 h-4" />
              )}
            </button>
          )}

          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="h-7 w-7 rounded-lg bg-gradient-to-tr from-blue-600 via-indigo-600 to-indigo-700 flex items-center justify-center text-white shadow-xs">
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
            </div>
            <span className="text-sm font-black tracking-tight text-slate-900 hidden sm:inline">
              Unsheet
            </span>
          </div>

          <ChevronRight className="w-3.5 h-3.5 text-slate-300 shrink-0" aria-hidden="true" />

          {/* Breadcrumbs */}
          <div className="flex items-center gap-1.5 text-xs min-w-0">
            {workbookName ? (
              <>
                <span className="font-medium text-slate-600 truncate max-w-[120px] sm:max-w-[180px]">
                  {workbookName}
                </span>
                {activeSheetName && (
                  <>
                    <ChevronRight className="w-3 h-3 text-slate-300 shrink-0" aria-hidden="true" />
                    <span className="font-semibold text-slate-900 truncate max-w-[100px] sm:max-w-[150px]">
                      {activeSheetName}
                    </span>
                  </>
                )}
                {typeof rowCount === 'number' && typeof colCount === 'number' && (
                  <span className="text-[10px] text-slate-600 font-mono hidden md:inline ml-1 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200/60">
                    {rowCount.toLocaleString()}r × {colCount}c
                  </span>
                )}
              </>
            ) : (
              <span className="font-medium text-slate-500">
                Studio
              </span>
            )}
          </div>
        </div>

        {/* Center: In-Browser Privacy Badge */}
        <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/70 text-[11px] font-semibold text-emerald-800 shadow-xs">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" aria-hidden="true" />
          <span>In-Browser Privacy</span>
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={onUploadClick}
            className="h-8 px-2.5 text-xs font-medium text-slate-700 hover:text-slate-900 border-slate-200 hover:bg-slate-50"
          >
            <UploadCloud className="w-3.5 h-3.5 sm:mr-1.5 text-slate-500" />
            <span className="hidden sm:inline">New File</span>
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={onShareClick}
            className="h-8 px-2.5 text-xs font-medium text-slate-700 hover:text-slate-900 border-slate-200 hover:bg-slate-50"
          >
            <Share2 className="w-3.5 h-3.5 sm:mr-1.5 text-slate-500" />
            <span className="hidden sm:inline">Share</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
