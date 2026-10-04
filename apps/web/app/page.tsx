'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldCheck,
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Sparkles,
  Layers,
  ArrowRight,
  AlertCircle,
  FileText,
} from 'lucide-react';
import type { DashboardSpec, SheetModel, WorkbookModel } from '@unsheet/contracts';
import {
  parseWorkbook,
  normaliseWorkbook,
  profileSheet,
  generateDashboardSpec,
} from '@unsheet/engine';
import {
  SAMPLE_WORKBOOKS,
  getSampleWorkbookBytes,
  type SampleWorkbookMeta,
} from '@/lib/sample-workbooks';
import { DashboardRenderer } from '@/components/dashboard/DashboardRenderer';
import { AskYourDataDrawer } from '@/components/chat/AskYourDataDrawer';
import { SpecRefineBar } from '@/components/chat/SpecRefineBar';
import { ExportDropdown } from '@/components/export/ExportDropdown';
import { ShareModal } from '@/components/share/ShareModal';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Bot } from 'lucide-react';

export interface PipelineTiming {
  parseMs: number;
  normaliseMs: number;
  profileMs: number;
  specGenMs: number;
  renderMs: number;
  totalMs: number;
}

export default function HomePage() {
  const [activeSampleId, setActiveSampleId] = useState<string>('project-pipeline');
  const [workbook, setWorkbook] = useState<WorkbookModel | null>(null);
  const [activeSheetIndex, setActiveSheetIndex] = useState<number>(0);
  const [spec, setSpec] = useState<DashboardSpec | null>(null);
  const [timing, setTiming] = useState<PipelineTiming | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isAskDrawerOpen, setIsAskDrawerOpen] = useState<boolean>(false);
  const [isSpecRefineOpen, setIsSpecRefineOpen] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);

  const pipelineRunId = useRef<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Executes the full Unsheet pipeline from raw bytes:
   * Parse -> Normalise -> Profile -> SpecGen -> Render
   */
  const processSpreadsheetBytes = async (
    bytes: Uint8Array,
    filename: string,
    sampleId?: string
  ) => {
    const currentRun = ++pipelineRunId.current;
    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const overallStart = performance.now();

      // Step 1: Parse
      const t0 = performance.now();
      const rawWorkbook = await parseWorkbook(bytes, { filename, calculateHash: false });
      const parseMs = Math.round((performance.now() - t0) * 10) / 10;

      // Step 2: Normalise
      const t1 = performance.now();
      const normalisedWorkbook = normaliseWorkbook(rawWorkbook);
      const normaliseMs = Math.round((performance.now() - t1) * 10) / 10;

      if (normalisedWorkbook.sheets.length === 0) {
        throw new Error('Workbook contains no readable sheets with tabular data.');
      }

      // Step 3: Profile Active Sheet
      const sheetIndex = 0;
      const targetSheet = normalisedWorkbook.sheets[sheetIndex]!;
      const t2 = performance.now();
      const profile = profileSheet(targetSheet);
      const profileMs = Math.round((performance.now() - t2) * 10) / 10;

      // Step 4: Spec Generation
      const t3 = performance.now();
      const dashboardSpec = generateDashboardSpec(profile, {
        title: `${targetSheet.name} Dashboard`,
      });
      const specGenMs = Math.round((performance.now() - t3) * 10) / 10;

      const t4 = performance.now();
      const renderMs = Math.round((performance.now() - t4) * 10) / 10;
      const totalMs = Math.round((performance.now() - overallStart) * 10) / 10;

      if (currentRun !== pipelineRunId.current) return;

      setWorkbook(normalisedWorkbook);
      setActiveSheetIndex(sheetIndex);
      setSpec(dashboardSpec);
      setTiming({
        parseMs,
        normaliseMs,
        profileMs,
        specGenMs,
        renderMs,
        totalMs,
      });
      if (sampleId) {
        setActiveSampleId(sampleId);
      } else {
        setActiveSampleId('');
      }
    } catch (err) {
      if (currentRun !== pipelineRunId.current) return;
      console.error('[Unsheet Pipeline Error]:', err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Failed to process spreadsheet file.'
      );
    } finally {
      if (currentRun === pipelineRunId.current) {
        setIsProcessing(false);
      }
    }
  };

  /**
   * Switch active sheet in the currently loaded workbook
   */
  const handleSheetSwitch = (index: number) => {
    if (!workbook || !workbook.sheets[index]) return;
    setActiveSheetIndex(index);

    try {
      const targetSheet = workbook.sheets[index]!;
      const t0 = performance.now();
      const profile = profileSheet(targetSheet);
      const profileMs = Math.round((performance.now() - t0) * 10) / 10;

      const t1 = performance.now();
      const dashboardSpec = generateDashboardSpec(profile, {
        title: `${targetSheet.name} Dashboard`,
      });
      const specGenMs = Math.round((performance.now() - t1) * 10) / 10;

      setSpec(dashboardSpec);
      setTiming((prev) =>
        prev
          ? {
              ...prev,
              profileMs,
              specGenMs,
              totalMs: Math.round((prev.parseMs + prev.normaliseMs + profileMs + specGenMs) * 10) / 10,
            }
          : null
      );
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Failed to profile worksheet.'
      );
    }
  };

  /**
   * Load a pre-configured sample workbook
   */
  const handleLoadSample = (sample: SampleWorkbookMeta) => {
    const { bytes, meta } = getSampleWorkbookBytes(sample.id);
    processSpreadsheetBytes(bytes, meta.filename, meta.id);
  };

  /**
   * Handle user file drop or selection
   */
  const handleFileUpload = async (file: File) => {
    try {
      let bytes: Uint8Array;
      if (file.name.endsWith('.csv') && typeof file.text === 'function') {
        const text = await file.text();
        bytes = new TextEncoder().encode(text);
      } else if (typeof file.arrayBuffer === 'function') {
        const arrayBuffer = await file.arrayBuffer();
        bytes = new Uint8Array(arrayBuffer);
      } else if (typeof file.text === 'function') {
        const text = await file.text();
        bytes = new TextEncoder().encode(text);
      } else {
        throw new Error('Unable to read uploaded file format in this browser');
      }
      processSpreadsheetBytes(bytes, file.name);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Error reading uploaded file');
    }
  };

  // Load default sample on mount
  useEffect(() => {
    const defaultSample = SAMPLE_WORKBOOKS[0];
    if (defaultSample) {
      handleLoadSample(defaultSample);
    }
  }, []);

  const activeSheet: SheetModel | null =
    workbook && workbook.sheets[activeSheetIndex]
      ? workbook.sheets[activeSheetIndex]!
      : null;

  const currentProfile = React.useMemo(() => {
    if (!activeSheet) {
      return {
        sheetId: 'default',
        sheetName: 'default',
        rowCount: 0,
        columnCount: 0,
        columnProfiles: [],
        recommendedDimensions: [],
        recommendedMeasures: [],
      };
    }
    return profileSheet(activeSheet);
  }, [activeSheet]);

  return (
    <main className="min-h-screen bg-slate-50/50 text-slate-900 pb-16">
      {/* 1. Header Navigation */}
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black tracking-tight text-slate-900">
                  Unsheet
                </h1>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/80 rounded px-1.5 py-0.2">
                  Preview
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium hidden sm:block">
                Any spreadsheet. Instant dashboard.
              </p>
            </div>
          </div>

          {/* Privacy Badge */}
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 border border-emerald-200/80 shadow-xs">
            <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline">100% In-Browser: your data never leaves your device</span>
            <span className="sm:hidden">100% In-Browser</span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-6">
        {/* 2. Upload Zone & Sample Loaders Row */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* File Upload Dropzone (5 cols) */}
          <div className="lg:col-span-5 flex flex-col justify-between rounded-2xl border-2 border-dashed border-slate-200 bg-white p-5 hover:border-blue-400 transition-colors shadow-xs">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const file = e.dataTransfer.files[0];
                if (file) {
                  handleFileUpload(file);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              data-testid="upload-dropzone"
              className={cn(
                'flex flex-col items-center justify-center text-center cursor-pointer p-6 rounded-xl transition-all',
                isDragging ? 'bg-blue-50/70 border border-blue-400' : 'hover:bg-slate-50'
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.csv"
                data-testid="file-upload-input"
                className="hidden"
                onChange={(e) => {
                  const eventTarget = e.target as HTMLInputElement;
                  const files =
                    eventTarget.files && eventTarget.files.length > 0
                      ? eventTarget.files
                      : (e as unknown as { target: { files?: FileList | File[] } }).target?.files;
                  const file = files?.[0];
                  if (file) {
                    handleFileUpload(file);
                  }
                }}
              />
              <div className="h-12 w-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 mb-3 shadow-inner">
                <UploadCloud className="h-6 w-6" aria-hidden="true" />
              </div>
              <h2 className="text-sm font-bold text-slate-800">
                Drop your spreadsheet here
              </h2>
              <p className="mt-1 text-xs text-slate-500 max-w-xs">
                Supports Excel (<span className="font-mono text-slate-700">.xlsx</span>) and CSV (<span className="font-mono text-slate-700">.csv</span>) files. Processed instantly in WebAssembly & client memory.
              </p>
              <button
                type="button"
                className="mt-3.5 inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 bg-blue-50/60 hover:bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200/60 transition-colors"
              >
                Browse computer
              </button>
            </div>

            <div className="mt-2 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
              <span>Max 50MB</span>
              <span>Zero server upload</span>
            </div>
          </div>

          {/* Sample Workbooks Loader (7 cols) */}
          <div className="lg:col-span-7 flex flex-col justify-between rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" aria-hidden="true" />
                  <h2 className="text-sm font-bold text-slate-800">
                    Try Pre-loaded Workbooks
                  </h2>
                </div>
                <span className="text-[11px] text-slate-600">
                  Instant one-click demo
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {SAMPLE_WORKBOOKS.map((sample) => {
                  const isSelected = activeSampleId === sample.id;

                  return (
                    <button
                      key={sample.id}
                      type="button"
                      onClick={() => handleLoadSample(sample)}
                      disabled={isProcessing}
                      className={cn(
                        'flex flex-col text-left p-3.5 rounded-xl border text-xs transition-all relative group',
                        isSelected
                          ? 'border-blue-500 bg-blue-50/40 ring-2 ring-blue-500/20 shadow-xs'
                          : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50/60 bg-white'
                      )}
                    >
                      <div className="flex items-start justify-between w-full mb-1">
                        <span className="font-bold text-slate-800 group-hover:text-blue-600 transition-colors">
                          {sample.name}
                        </span>
                        <span
                          className={cn(
                            'text-[10px] font-semibold rounded px-1.5 py-0.5 border',
                            isSelected
                              ? 'bg-blue-100 text-blue-700 border-blue-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          )}
                        >
                          {sample.badge}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                        {sample.description}
                      </p>
                      <div className="mt-2.5 flex items-center justify-between w-full text-[10px] text-slate-600">
                        <span>{sample.domain}</span>
                        <span className="font-mono text-slate-600">{sample.filename}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-100 text-[11px] text-slate-600 flex items-center justify-between">
              <span>Select any sample to re-run the end-to-end intelligence engine</span>
              <span>Domain datasets</span>
            </div>
          </div>
        </section>

        {/* 3. Pipeline Status Bar */}
        {timing && (
          <section
            role="region"
            aria-label="Engine pipeline status"
            className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs"
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" aria-hidden="true" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Engine Pipeline
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 border border-emerald-200">
                  <CheckCircle2 className="h-3 w-3" />
                  {timing.totalMs}ms Total
                </span>
              </div>

              {/* Pipeline Step Sequence */}
              <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
                {/* Parse */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                  <span className="font-semibold text-slate-700">1. Parse</span>
                  <span className="font-mono text-[11px] text-slate-500">{timing.parseMs}ms</span>
                </div>
                <ArrowRight className="h-3 w-3 text-slate-300 hidden sm:block" />

                {/* Normalise */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                  <span className="font-semibold text-slate-700">2. Normalise</span>
                  <span className="font-mono text-[11px] text-slate-500">{timing.normaliseMs}ms</span>
                </div>
                <ArrowRight className="h-3 w-3 text-slate-300 hidden sm:block" />

                {/* Profile */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                  <span className="font-semibold text-slate-700">3. Profile</span>
                  <span className="font-mono text-[11px] text-slate-500">{timing.profileMs}ms</span>
                </div>
                <ArrowRight className="h-3 w-3 text-slate-300 hidden sm:block" />

                {/* SpecGen */}
                <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1">
                  <span className="font-semibold text-slate-700">4. SpecGen</span>
                  <span className="font-mono text-[11px] text-slate-500">{timing.specGenMs}ms</span>
                </div>
                <ArrowRight className="h-3 w-3 text-slate-300 hidden sm:block" />

                {/* Render */}
                <div className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 rounded-lg px-2.5 py-1 text-blue-700">
                  <span className="font-bold">5. Render</span>
                  <span className="font-mono text-[11px] font-semibold">{timing.renderMs}ms</span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Error Alert */}
        {errorMessage && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800"
          >
            <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold">Failed to load workbook</h3>
              <p className="mt-1 text-xs text-rose-700">{errorMessage}</p>
            </div>
          </div>
        )}

        {/* 4. Sheet Selector Tabs (if multi-sheet) */}
        {workbook && workbook.sheets.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <span className="text-xs font-semibold text-slate-500 flex items-center gap-1 pl-1">
              <Layers className="h-3.5 w-3.5" /> Sheets:
            </span>
            {workbook.sheets.map((sheet, sIdx) => (
              <button
                key={sheet.id}
                type="button"
                onClick={() => handleSheetSwitch(sIdx)}
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors',
                  activeSheetIndex === sIdx
                    ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                )}
              >
                <FileText className="h-3 w-3" />
                <span>{sheet.name}</span>
                <span className="text-[10px] opacity-75 font-mono">({sheet.rowCount} rows)</span>
              </button>
            ))}
          </div>
        )}

        {/* 5. Rendered Dashboard */}
        {isProcessing ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-xs">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent mb-4"></div>
            <h3 className="text-base font-bold text-slate-800">
              Profiling spreadsheet & generating dashboard spec...
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Inferring data types, computing semantic roles, creating responsive grid layout
            </p>
          </div>
        ) : spec && activeSheet ? (
          <div className="space-y-4">
            {/* Dashboard Action Toolbar */}
            <div className="flex items-center justify-between bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 shadow-xs">
              <div className="flex items-center space-x-2">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Sheet: {activeSheet.name}
                </span>
                <span className="text-xs text-slate-500">
                  ({activeSheet.rowCount} rows, {activeSheet.columnCount} columns)
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsSpecRefineOpen((prev) => !prev)}
                  className="text-xs font-medium border-indigo-200 hover:bg-indigo-50 text-indigo-700 dark:border-indigo-900 dark:text-indigo-300 dark:hover:bg-indigo-950/50"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1.5 text-indigo-600 dark:text-indigo-400" />
                  {isSpecRefineOpen ? 'Hide AI Refine' : 'AI Refine'}
                </Button>
                <Button
                  size="sm"
                  onClick={() => setIsAskDrawerOpen(true)}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium shadow-xs"
                >
                  <Bot className="w-3.5 h-3.5 mr-1.5" />
                  Ask Data
                </Button>
                <ExportDropdown sheet={activeSheet} />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsShareModalOpen(true)}
                  className="text-xs font-medium"
                >
                  Share
                </Button>
              </div>
            </div>

            {/* Spec Refine Bar */}
            {isSpecRefineOpen && (
              <SpecRefineBar
                currentSpec={spec}
                profile={currentProfile}
                onSpecUpdate={setSpec}
              />
            )}

            <section className="rounded-2xl border border-slate-200/80 bg-white shadow-xs overflow-hidden">
              <DashboardRenderer
                spec={spec}
                sheet={activeSheet}
              />
            </section>

            {/* Ask Your Data Drawer */}
            <AskYourDataDrawer
              isOpen={isAskDrawerOpen}
              onClose={() => setIsAskDrawerOpen(false)}
              sheet={activeSheet}
              profile={currentProfile}
              onAddWidget={(widget) => {
                setSpec((prev) => (prev ? { ...prev, widgets: [...prev.widgets, widget] } : prev));
              }}
            />

            {/* Share Modal */}
            <ShareModal
              isOpen={isShareModalOpen}
              onClose={() => setIsShareModalOpen(false)}
              spec={spec}
              sheet={activeSheet}
            />
          </div>
        ) : null}
      </div>
    </main>
  );
}
