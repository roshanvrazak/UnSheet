'use client';

import React, { useRef, useState } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import {
  SAMPLE_WORKBOOKS,
  type SampleWorkbookMeta,
} from '@/lib/sample-workbooks';
import { cn } from '@/lib/utils';

export interface UploadHeroProps {
  onFileUpload: (file: File) => void;
  onSelectSample: (sample: SampleWorkbookMeta) => void;
  activeSampleId?: string | undefined;
  isProcessing: boolean;
  fileInputRef?: React.RefObject<HTMLInputElement | null> | undefined;
}

export function UploadHero({
  onFileUpload,
  onSelectSample,
  activeSampleId,
  isProcessing,
  fileInputRef,
}: UploadHeroProps) {
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const internalInputRef = useRef<HTMLInputElement>(null);
  const resolvedInputRef = fileInputRef || internalInputRef;

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (isProcessing) return;
    const file = e.dataTransfer.files[0];
    if (file) {
      onFileUpload(file);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto py-8 px-4 sm:px-6 space-y-8 animate-in fade-in duration-300">
      {/* 1. Hero Title & Value Proposition */}
      <div className="text-center space-y-3 max-w-2xl mx-auto">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200/80 text-xs font-semibold text-indigo-700 shadow-xs">
          <Zap className="w-3.5 h-3.5 text-indigo-600" aria-hidden="true" />
          <span>Instant In-Browser Analytics Studio</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
          Any spreadsheet. Instant dashboard.
        </h1>
        <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
          Drop any raw Excel or CSV file. Unsheet automatically profiles your columns, selects key metrics, and builds an interactive analytical dashboard in your browser.
        </p>
      </div>

      {/* 2. Modern Dropzone Card */}
      <div className="relative group">
        {/* Subtle Ambient Radial Glow */}
        <div className="absolute -inset-1 rounded-3xl bg-blue-500/5 blur-xl opacity-75 group-hover:opacity-100 transition-opacity" />

        <div
          onDragOver={(e) => {
            e.preventDefault();
            if (!isProcessing) setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setIsDragging(false);
          }}
          onDrop={handleDrop}
          onClick={() => {
            if (!isProcessing) resolvedInputRef.current?.click();
          }}
          className={cn(
            'relative flex flex-col items-center justify-center text-center cursor-pointer p-8 sm:p-12 rounded-2xl border-2 border-dashed bg-white transition-all shadow-sm',
            isDragging
              ? 'border-indigo-500 bg-indigo-50/50 ring-4 ring-indigo-500/10'
              : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50/70',
            isProcessing && 'opacity-60 cursor-not-allowed'
          )}
        >
          <input
            ref={resolvedInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,.tsv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/tab-separated-values"
            data-testid="file-upload-input"
            className="hidden"
            disabled={isProcessing}
            onClick={(e) => {
              (e.target as HTMLInputElement).value = '';
            }}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                onFileUpload(file);
              }
              e.target.value = '';
            }}
          />

          <div className="h-14 w-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-4 shadow-xs group-hover:scale-105 transition-transform">
            <UploadCloud className="h-7 w-7" aria-hidden="true" />
          </div>

          <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            Drop your spreadsheet here
          </h2>
          <p className="mt-1 text-xs text-slate-500 max-w-sm">
            Supports <span className="font-mono text-slate-700">.xlsx</span>, <span className="font-mono text-slate-700">.xls</span>, <span className="font-mono text-slate-700">.csv</span>, and <span className="font-mono text-slate-700">.tsv</span> files up to 50MB.
          </p>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              disabled={isProcessing}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-lg shadow-sm transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Browse files</span>
            </button>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-600 font-medium">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              100% In-Browser: your data never leaves your device
            </span>
            <span>•</span>
            <span>Zero server upload</span>
            <span>•</span>
            <span>DuckDB-WASM Engine</span>
          </div>
        </div>
      </div>

      {/* 3. Pre-loaded Sample Workbooks */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" aria-hidden="true" />
            <h3 className="text-sm font-bold text-slate-800 tracking-tight">
              Or explore interactive sample datasets
            </h3>
          </div>
          <span className="text-xs text-slate-600">One-click live demo</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {SAMPLE_WORKBOOKS.map((sample) => {
            const isSelected = activeSampleId === sample.id;

            return (
              <button
                key={sample.id}
                type="button"
                onClick={() => onSelectSample(sample)}
                disabled={isProcessing}
                className={cn(
                  'flex flex-col text-left p-3.5 rounded-xl border text-xs transition-all relative group bg-white shadow-xs',
                  isSelected
                    ? 'border-indigo-500 bg-indigo-50/40 ring-2 ring-indigo-500/20'
                    : 'border-slate-200/80 hover:border-indigo-300 hover:shadow-sm'
                )}
              >
                <div className="flex items-start justify-between w-full mb-1">
                  <span className="font-bold text-slate-800 group-hover:text-indigo-600 transition-colors line-clamp-1">
                    {sample.name}
                  </span>
                  <span
                    className={cn(
                      'text-[10px] font-semibold rounded px-1.5 py-0.5 border shrink-0 ml-1',
                      isSelected
                        ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                        : 'bg-slate-100 text-slate-600 border-slate-200'
                    )}
                  >
                    {sample.badge}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                  {sample.description}
                </p>
                <div className="mt-2.5 flex items-center justify-between w-full text-[10px] text-slate-600 pt-2 border-t border-slate-100">
                  <span className="font-medium text-slate-600">{sample.domain}</span>
                  <span className="font-mono text-slate-600">{sample.filename}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
