'use client';

import React, { useEffect, useState } from 'react';
import { Layers, X, Hash, Type, Calendar, DollarSign, Tag, Search, Check, ShieldCheck, ChevronRight, RefreshCw, Table2 } from 'lucide-react';
import type { SheetModel, ColumnProfile } from '@unsheet/contracts';
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
function TypeIcon({ column }: { column: ColumnProfile }) {
  const Icon = column.inferredType === 'currency' ? DollarSign : column.semanticRole === 'measure' ? Hash : column.inferredType === 'date' ? Calendar : column.inferredType === 'category' ? Tag : Type;
  return <Icon size={13} aria-hidden="true" />;
}

export function FieldInspector({ isOpen, onClose, sheets, activeSheetIndex, onSelectSheet, columnProfiles, selectedColumnKeys, onToggleColumn, onSelectAll, onClearAll, onApplyFields, isDirty, pipelineTiming }: FieldInspectorProps) {
  const [search, setSearch] = useState('');
  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);
  useEffect(() => { setSearch(''); }, [activeSheetIndex, sheets]);
  if (!isOpen) return null;
  const visibleColumns = columnProfiles.filter(column => `${column.originalName} ${column.columnKey}`.toLowerCase().includes(search.toLowerCase()));
  return (
    <>
      <button className="inspector-backdrop" aria-label="Close sheet inspector overlay" onClick={onClose} type="button" />
      <aside className="field-inspector" aria-label="Sheet and field inspector">
        <div className="inspector-heading"><span><Layers size={17} aria-hidden="true" />Data explorer</span><button type="button" className="icon-action" onClick={onClose} aria-label="Close inspector"><X size={16} aria-hidden="true" /></button></div>
        <div className="inspector-scroll">
          <div className="inspector-label"><span>WORKSHEETS</span><span>{sheets.length.toString().padStart(2, '0')}</span></div>
          <div className="sheet-list">
            {sheets.map((sheet, index) => (
              <button type="button" key={sheet.id || index} className={cn('sheet-option', activeSheetIndex === index && 'is-active')} aria-pressed={activeSheetIndex === index} onClick={() => onSelectSheet(index)}>
                <Table2 size={16} aria-hidden="true" /><span><strong>{sheet.name.replace(/_/g, ' ')}</strong><small>{sheet.rowCount.toLocaleString()} rows</small></span><ChevronRight size={14} aria-hidden="true" />
              </button>
            ))}
          </div>
          <div className="inspector-label field-label"><span>FIELDS</span><span>{selectedColumnKeys.size} / {columnProfiles.length}</span></div>
          <p className="field-hint">Choose the fields for your dashboard.</p>
          <label className="field-search"><Search size={14} aria-hidden="true" /><input type="search" aria-label="Search fields" placeholder="Find a field…" value={search} onChange={event => setSearch(event.target.value)} /></label>
          <div className="field-selection"><span>{selectedColumnKeys.size} selected</span><span><button type="button" onClick={onSelectAll}>Select all</button><span> / </span><button type="button" onClick={onClearAll}>Clear</button></span></div>
          <div className="field-list">
            {visibleColumns.map(column => (
              <label key={column.columnKey} className={cn('field-option', selectedColumnKeys.has(column.columnKey) && 'is-checked')}>
                <input type="checkbox" aria-label={`toggle ${column.columnKey}`} checked={selectedColumnKeys.has(column.columnKey)} onChange={() => onToggleColumn(column.columnKey)} />
                <span className="field-name" title={column.columnKey}>{column.originalName}</span>
                <span className="field-type" title={column.inferredType}><TypeIcon column={column} /><span className="sr-only">{column.inferredType}</span></span>
              </label>
            ))}
            {visibleColumns.length === 0 && <p className="field-hint py-4" role="status">No matching fields.</p>}
          </div>
          <button type="button" className="apply-fields" onClick={onApplyFields} disabled={!isDirty || selectedColumnKeys.size === 0}><RefreshCw size={14} aria-hidden="true" />Update Dashboard</button>
        </div>
        <div className="inspector-footer">
          <span className="local-label"><ShieldCheck size={15} aria-hidden="true" />Local by design</span>
          <p>Your workbook stays in this browser.</p>
          {pipelineTiming && <span className="engine-ready"><Check size={12} aria-hidden="true" />Ready in {pipelineTiming.totalMs}ms</span>}
        </div>
      </aside>
    </>
  );
}
