'use client';

import React from 'react';
import {
  Layers,
  Clock,
  RefreshCw,
  X,
  Hash,
  Type,
  Calendar,
  DollarSign,
  Tag,
} from 'lucide-react';
import type { SheetModel, ColumnProfile } from '@unsheet/contracts';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { PipelineTiming } from '@/app/page';

export interface FieldInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  sheets: SheetModel[];
  activeSheetIndex: number;
  onSelectSheet: (index: number) => void;
  columnProfiles: ColumnProfile[];
  selectedColumnKeys: Set<string>;
  onToggleColumn: (key: string) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  onApplyFields: () => void;
  isDirty: boolean;
  pipelineTiming?: PipelineTiming | null;
}

function getTypeIcon(inferredType: string, semanticRole?: string) {
  if (inferredType === 'currency') return <DollarSign className="w-3 h-3 text-emerald-600" />;
  if (inferredType === 'number' || semanticRole === 'measure') return <Hash className="w-3 h-3 text-blue-600" />;
  if (inferredType === 'date' || semanticRole === 'time') return <Calendar className="w-3 h-3 text-amber-600" />;
  if (inferredType === 'category') return <Tag className="w-3 h-3 text-purple-600" />;
  return <Type className="w-3 h-3 text-slate-500" />;
}

export function FieldInspector({
  isOpen,
  onClose,
  sheets,
  activeSheetIndex,
  onSelectSheet,
  columnProfiles,
  selectedColumnKeys,
  onToggleColumn,
  onSelectAll,
  onClearAll,
  onApplyFields,
  isDirty,
  pipelineTiming,
}: FieldInspectorProps) {
  if (!isOpen) return null;

  return (
    <aside
      aria-label="Sheet and field inspector"
      className="w-72 shrink-0 border-r border-slate-200/80 bg-white flex flex-col h-[calc(100vh-3.5rem)] sticky top-14 z-30 transition-all shadow-xs"
    >
      {/* 1. Header with Close Button for Mobile */}
      <div className="p-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div className="flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-indigo-600" />
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
            Inspector
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close inspector"
          className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 sm:hidden"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3.5 space-y-5">
        {/* 2. Sheet Switcher */}
        {sheets.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <span>Sheets ({sheets.length})</span>
            </div>
            <div className="space-y-1">
              {sheets.map((s, idx) => {
                const isActive = activeSheetIndex === idx;
                return (
                  <button
                    key={s.id || idx}
                    type="button"
                    onClick={() => onSelectSheet(idx)}
                    className={cn(
                      'w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors text-left',
                      isActive
                        ? 'bg-indigo-50 text-indigo-900 border border-indigo-200/80 shadow-xs'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    )}
                  >
                    <span className="truncate max-w-[140px] font-semibold">{s.name}</span>
                    <span className="text-[10px] text-slate-600 font-mono">
                      {s.rowCount.toLocaleString()} rows
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 3. Field / Column Selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
            <span>Fields ({selectedColumnKeys.size}/{columnProfiles.length})</span>
            <div className="flex items-center gap-1.5 text-[10px] lowercase">
              <button
                type="button"
                onClick={onSelectAll}
                className="text-indigo-600 hover:text-indigo-800 font-medium"
              >
                all
              </button>
              <span>•</span>
              <button
                type="button"
                onClick={onClearAll}
                className="text-slate-500 hover:text-slate-700 font-medium"
              >
                none
              </button>
            </div>
          </div>

          <p className="text-[11px] text-slate-600 leading-tight">
            Select which columns generate KPI summaries, charts, and tables.
          </p>

          <div className="space-y-1 pt-1">
            {columnProfiles.map((col) => {
              const isChecked = selectedColumnKeys.has(col.columnKey);
              return (
                <label
                  key={col.columnKey}
                  className={cn(
                    'flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer border transition-all',
                    isChecked
                      ? 'bg-slate-50/70 border-slate-200/90 text-slate-900'
                      : 'bg-white border-transparent text-slate-400 hover:bg-slate-50/40'
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <input
                      type="checkbox"
                      aria-label={`toggle ${col.columnKey}`}
                      checked={isChecked}
                      onChange={() => onToggleColumn(col.columnKey)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                    />
                    <span className="truncate font-medium max-w-[120px] text-slate-800">
                      {col.columnKey}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {getTypeIcon(col.inferredType, col.semanticRole)}
                    <span className="text-[10px] text-slate-600 font-mono">
                      {col.inferredType}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. Footer Actions & Telemetry */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50 space-y-2">
        <Button
          size="sm"
          onClick={onApplyFields}
          disabled={!isDirty || selectedColumnKeys.size === 0}
          className={cn(
            'w-full text-xs font-semibold shadow-xs transition-all',
            isDirty
              ? 'bg-indigo-600 hover:bg-indigo-700 text-white animate-pulse'
              : 'bg-slate-200 text-slate-500 cursor-not-allowed'
          )}
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          Update Dashboard
        </Button>

        {pipelineTiming && (
          <div className="flex items-center justify-between text-[10px] text-slate-600 font-mono pt-1">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>{pipelineTiming.totalMs}ms in WASM</span>
            </span>
            <span>Profile: {pipelineTiming.profileMs}ms</span>
          </div>
        )}
      </div>
    </aside>
  );
}
